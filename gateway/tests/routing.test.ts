import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { isReservedName, rootShortLinkPattern, rootShortLinkSource } from "@short/routing";

describe("Frontend routing boundaries", () => {
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
