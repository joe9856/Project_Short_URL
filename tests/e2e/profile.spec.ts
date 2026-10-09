import { test, expect } from "@playwright/test";

test("Change own name, keep it after reload and login, and preserve text cursors in inputs", async ({
  page,
  context,
}, testInfo) => {
  const email = `profile-${Date.now()}-${testInfo.project.name}@e2e.test`;
  const newName = "ชื่อใหม่ " + testInfo.project.name;
  await page.goto("/profile");
  await expect(page).toHaveURL(/login/);
  await page.goto("/register");
  await page.getByLabel("ชื่อ", { exact: true }).fill("ชื่อเดิม");
  await page.getByLabel("อีเมล", { exact: true }).fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "สมัครสมาชิก", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByRole("heading", { name: "แดชบอร์ด", exact: true }),
  ).toHaveCSS("cursor", "default");
  await page
    .locator(".header-nav")
    .getByRole("link", { name: "บัญชีของฉัน", exact: true })
    .click();
  await expect(page).toHaveURL(/profile/);
  const input = page.getByLabel("ชื่อของคุณ", { exact: true });
  const save = page.getByRole("button", { name: "บันทึกชื่อ", exact: true });
  await expect(input).toHaveValue("ชื่อเดิม");
  await expect(input).toHaveCSS("cursor", "text");
  await expect(save).toHaveCSS("cursor", "pointer");
  await input.fill("   ");
  await save.click();
  await expect(page.getByRole("alert")).toHaveText("กรุณากรอกชื่อ");
  await input.fill(`  ${newName}  `);
  await save.click();
  await expect(page.getByRole("status")).toHaveText("บันทึกชื่อเรียบร้อยแล้ว");
  await expect(input).toHaveValue(newName);
  await expect(page.locator(".account-name")).toHaveText(newName);
  const stored = await context.request.get("/api/auth/me");
  expect((await stored.json()).user.name).toBe(newName);
  const forged = await context.request.patch("/api/auth/me", {
    headers: { Origin: "http://localhost:5173" },
    data: { name: "ไม่ควรบันทึก", id: "another-user" },
  });
  expect(forged.status()).toBe(400);
  await page.reload();
  await expect(input).toHaveValue(newName);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/" + testInfo.project.name + "-profile.png",
    fullPage: true,
  });
  await page.route("**/api/auth/me", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { message: "บริการไม่พร้อมใช้งาน กรุณาลองอีกครั้ง" },
          }),
        })
      : route.continue(),
  );
  await input.fill("ชื่อที่ยังไม่ถูกบันทึก");
  await save.click();
  await expect(page.getByRole("alert")).toContainText("บริการไม่พร้อมใช้งาน");
  await expect(input).toHaveValue("ชื่อที่ยังไม่ถูกบันทึก");
  await expect(page.locator(".account-name")).toHaveText(newName);
  await page.unroute("**/api/auth/me");
  await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
  const rejected = await context.request.patch("/api/auth/me", {
    headers: { Origin: "http://localhost:5173" },
    data: { name: "ไม่ได้เข้าสู่ระบบ" },
  });
  expect(rejected.status()).toBe(401);
  await page.goto("/login");
  await page.getByLabel("อีเมล", { exact: true }).fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator(".account-name")).toHaveText(newName);
  await expect(
    page.getByText(`สวัสดี ${newName}`, { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
});
