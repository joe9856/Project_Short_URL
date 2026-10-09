import { test, expect } from "@playwright/test";
test("Register → login → create → QR → redirect → stats → disable → logout", async ({
  page,
  context,
}, testInfo) => {
  const alias = "e2e-" + Date.now() + "-" + testInfo.project.name;
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /ย่อลิงก์ พร้อมแชร์/ }),
  ).toBeVisible();
  await page.goto("/register");
  await page.getByLabel("ชื่อ", { exact: true }).fill("ผู้ทดสอบ");
  await page.getByLabel("อีเมล", { exact: true }).fill(alias + "@e2e.test");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "สมัครสมาชิก", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.getByLabel("URL ปลายทาง").fill("https://example.com/e2e?x=1#part");
  await page.getByText("ตั้งค่าชื่อลิงก์และวันหมดอายุ (ไม่บังคับ)").click();
  await page.getByLabel("ชื่อที่กำหนดเอง").fill("LOGIN");
  await page.getByRole("button", { name: "ย่อลิงก์", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("ชื่อนี้ระบบใช้แล้ว");
  const rejected = await context.request.post("/api/links", {
    headers: { Origin: "http://localhost:5173" },
    data: { originalUrl: "https://example.com", alias: "LOGIN" },
  });
  expect(rejected.status()).toBe(400);
  await page.getByLabel("ชื่อที่กำหนดเอง").fill(alias);
  await page.getByRole("button", { name: "ย่อลิงก์", exact: true }).click();
  const result = page.getByLabel("ลิงก์ที่สร้าง");
  await expect(result).toBeVisible();
  const shortUrl = await result
    .getByRole("link", { name: new RegExp("/" + alias) })
    .getAttribute("href");
  expect(shortUrl).toBeTruthy();
  expect(new URL(shortUrl!).pathname).toBe("/" + alias);
  const legacy = await context.request.head(
    new URL("/s/" + alias, shortUrl!).href,
    { maxRedirects: 0 },
  );
  expect(legacy.status()).toBe(302);
  expect(legacy.headers().location).toBe("https://example.com/e2e?x=1#part");
  for (const format of ["PNG", "SVG"]) {
    const pending = page.waitForEvent("download");
    await result.getByRole("link", { name: format, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(
      alias + "." + format.toLowerCase(),
    );
  }
  // เปิดผ่าน Browser แต่สกัดหน้า example.com เพื่อให้ test ไม่พึ่งเว็บไซต์ภายนอก
  await context.route("https://example.com/**", (route) =>
    route.fulfill({ status: 200, body: "Destination reached" }),
  );
  const visitor = await context.newPage();
  await visitor.goto(shortUrl!);
  await expect(visitor).toHaveURL(/example.com\/e2e/);
  await visitor.close();
  await result.getByRole("link", { name: "ดูรายละเอียด →" }).click();
  await expect(
    page.getByRole("heading", { name: "รายละเอียดลิงก์", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".metrics").getByText("1", { exact: true }),
  ).toHaveCount(3);
  await page.screenshot({
    path: "test-results/" + testInfo.project.name + "-details.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("เปิดใช้งานลิงก์").uncheck();
  await page.getByRole("button", { name: "บันทึกการตั้งค่า" }).click();
  await expect(
    page.getByRole("status").getByText("บันทึกการตั้งค่าแล้ว"),
  ).toBeVisible();
  const unavailable = await context.request.get(shortUrl!, { maxRedirects: 0 });
  expect(unavailable.status()).toBe(410);
  await page.goto("/history");
  await page.getByLabel("ค้นหาลิงก์").fill(alias);
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page.locator(".link-row")).toHaveCount(1);
  await expect(
    page.locator(".link-row").getByText("ปิดใช้งาน", { exact: true }),
  ).toBeVisible();
  const historyRow = page.locator(".link-row");
  const enableLink = historyRow.getByRole("button", {
    name: "เปิดใช้งานลิงก์ " + alias,
    exact: true,
  });
  // การบันทึกล้มเหลวต้องคงรายการและสถานะเดิมไว้ให้ลองใหม่ได้
  await page.route(
    "**/api/links/*",
    async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "บริการทดสอบไม่พร้อม" } }),
      });
    },
    { times: 1 },
  );
  await enableLink.click();
  await expect(page.getByRole("alert")).toContainText("บันทึกสถานะลิงก์");
  await expect(
    historyRow.getByText("ปิดใช้งาน", { exact: true }),
  ).toBeVisible();
  await expect(enableLink).toBeEnabled();
  await enableLink.click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "เปิดใช้งานลิงก์ " + alias + " แล้ว" }),
  ).toBeVisible();
  await expect(
    historyRow.getByText("ใช้งานอยู่", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const restored = await context.request.head(shortUrl!, { maxRedirects: 0 });
  expect(restored.status()).toBe(302);
  expect(restored.headers().location).toBe("https://example.com/e2e?x=1#part");
  await expect(historyRow.locator(".click-count")).toContainText("1");
  // เมื่อสถานะไม่ตรงตัวกรอง ต้องนำรายการออกและคำนวณจำนวนรายการใหม่
  await page.getByLabel("สถานะลิงก์").selectOption("active");
  await expect(
    historyRow.getByText("ใช้งานอยู่", { exact: true }),
  ).toBeVisible();
  await historyRow
    .getByRole("button", {
      name: "ปิดใช้งานลิงก์ " + alias,
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "ปิดใช้งานลิงก์ " + alias + " แล้ว" }),
  ).toBeVisible();
  await expect(historyRow).toHaveCount(0);
  await expect(page.locator(".pagination")).toContainText("0 ลิงก์");
  const disabledAgain = await context.request.get(shortUrl!, {
    maxRedirects: 0,
  });
  expect(disabledAgain.status()).toBe(410);
  await page.getByLabel("สถานะลิงก์").selectOption("disabled");
  await expect(
    historyRow.getByText("ปิดใช้งาน", { exact: true }),
  ).toBeVisible();
  await expect(historyRow.locator(".click-count")).toContainText("1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/" + testInfo.project.name + "-history.png",
    fullPage: true,
  });
  await page.goto("/dashboard");
  const activeLinks = page
    .locator(".summary-card")
    .filter({ hasText: "ลิงก์ที่ใช้งาน" })
    .locator("strong");
  await expect(activeLinks).toHaveText("0");
  await page
    .getByRole("button", { name: "เปิดใช้งานลิงก์ " + alias, exact: true })
    .click();
  await expect(activeLinks).toHaveText("1");
  await page
    .getByRole("button", { name: "ปิดใช้งานลิงก์ " + alias, exact: true })
    .click();
  await expect(activeLinks).toHaveText("0");
  // เปิดลิงก์ที่หมดอายุจากประวัติไม่ได้ ต้องแก้วันหมดอายุก่อน
  const expiryAlias = "expiry-" + Date.now();
  const expiresAt = new Date(Date.now() + 5000).toISOString();
  const expiringResponse = await context.request.post("/api/links", {
    headers: { Origin: "http://localhost:5173" },
    data: { originalUrl: "https://example.com", alias: expiryAlias, expiresAt },
  });
  expect(expiringResponse.status()).toBe(201);
  const { link: expiring } = await expiringResponse.json();
  const disableExpiring = await context.request.patch(
    "/api/links/" + expiring.id,
    {
      headers: { Origin: "http://localhost:5173" },
      data: { isActive: false },
    },
  );
  expect(disableExpiring.status()).toBe(200);
  await expect
    .poll(() => Date.now(), { timeout: 10000 })
    .toBeGreaterThan(new Date(expiresAt).getTime());
  await page.goto("/history");
  await page.getByLabel("ค้นหาลิงก์").fill(expiryAlias);
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page.locator(".link-row")).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "เปิดใช้งานลิงก์ " + expiryAlias,
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "แก้วันหมดอายุ", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/links/" + expiring.id + "$"));
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("อีเมล", { exact: true }).fill(alias + "@e2e.test");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toHaveCount(0);
});

test("Home remains usable during an Auth outage and keyboard focus is visible", async ({
  page,
}, testInfo) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "AUTH_UNAVAILABLE", message: "บริการทดสอบไม่พร้อม" },
      }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("บริการทดสอบไม่พร้อม");
  await expect(
    page.getByRole("heading", { name: /ย่อลิงก์ พร้อมแชร์/ }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "ข้ามไปเนื้อหา" })).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/" + testInfo.project.name + "-home.png",
    fullPage: true,
  });
  await page.goto("/login");
  await page.getByLabel("อีเมล", { exact: true }).fill("missing-user@e2e.test");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }),
  ).toBeVisible();
});
