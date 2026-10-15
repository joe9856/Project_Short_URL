// อ่านกฎ packages/routing + path จาก App.tsx + frontend/vercel.json → ตรวจว่า Short URL ไม่แย่งเส้นทางหน้าจอ/API/ไฟล์
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { isReservedName, rootShortLinkPattern, rootShortLinkSource } from "@short/routing";

describe("Frontend routing boundaries", () => {
  it("loads the same routing rules in CommonJS and ESM without require(ESM) support", () => {
    // เปิด Node process แยก → โหลดแพ็กเกจทั้ง require/import → รับ JSON snapshot → ตรวจว่ากฎเท่ากันทั้งสองแบบ
    const output = execFileSync(process.execPath, ["--no-experimental-require-module", "-e", `
      const cjs = require("@short/routing");
      import("@short/routing").then((esm) => {
        const snapshot = (routing) => ({
          exports: Object.keys(routing).sort(),
          reservedNames: routing.reservedNames,
          pattern: routing.rootShortLinkPattern,
          source: routing.rootShortLinkSource,
          codePattern: String(routing.codePattern),
          reserved: routing.isReservedName("LOGIN"),
          short: routing.isShortLinkPath("/AbC_123?source=qr"),
          page: routing.isShortLinkPath("/login"),
          paths: [routing.shortLinkPath("hello"), routing.shortLinkPath("login")],
        });
        process.stdout.write(JSON.stringify({ cjs: snapshot(cjs), esm: snapshot(esm) }));
      }).catch((error) => { console.error(error); process.exitCode = 1; });
    `], { cwd: resolve("gateway"), encoding: "utf8", windowsHide: true });
    const { cjs, esm } = JSON.parse(output);
    expect(cjs).toEqual(esm);
    expect(cjs).toMatchObject({ reserved: true, short: true, page: false, paths: ["/hello", "/s/login"] });
  });
  // อ่าน Route หน้า React → ดึงชื่อจาก path → ส่งเข้า isReservedName; ต้องเป็นชื่อสงวนทั้งหมด
  it("reserves every page declared by the frontend router", () => {
    const app = readFileSync(resolve("frontend/src/App.tsx"), "utf8");
    const pages = [...app.matchAll(/path="\/([^"/:*]+)/g)].map((match) => match[1]);
    expect(pages.length).toBeGreaterThan(5);
    for (const page of pages) expect(isReservedName(page)).toBe(true);
  });
  it("keeps page, API and asset paths outside the short-link rewrite", () => {
    const pattern = new RegExp("^/" + rootShortLinkPattern + "/?$");
    for (const path of ["/login", "/Login", "/LOGIN/", "/register", "/api/auth/me", "/assets/app.js", "/links/abc", "/favicon.svg", "/ab", "/bad.code"])
      expect(pattern.test(path)).toBe(false);
    for (const path of ["/abc123", "/abc123/", "/login-123", "/AbC_123"])
      expect(pattern.test(path)).toBe(true);
    const config = JSON.parse(readFileSync(resolve("frontend/vercel.json"), "utf8"));
    expect(config.rewrites.find((route: { source: string }) => route.source === rootShortLinkSource)).toBeDefined();
    expect(config.rewrites.at(-1).destination).toBe("/index.html");
  });
});
