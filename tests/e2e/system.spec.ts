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
  await page.getByLabel("ชื่อที่กำหนดเอง").fill(alias);
  await page.getByRole("button", { name: "ย่อลิงก์", exact: true }).click();
  const result = page.getByLabel("ลิงก์ที่สร้าง");
  await expect(result).toBeVisible();
  const shortUrl = await result
    .getByRole("link", { name: new RegExp("/s/" + alias) })
    .getAttribute("href");
  expect(shortUrl).toBeTruthy();
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
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/" + testInfo.project.name + "-history.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("อีเมล", { exact: true }).fill(alias + "@e2e.test");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
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
