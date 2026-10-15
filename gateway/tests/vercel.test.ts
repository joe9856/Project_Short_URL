// จำลอง Environment ของ Vercel → createGateway/guards → ตรวจการตั้ง HTTPS และ IP ที่ใช้ส่งต่อ Service
import { describe, it, expect, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { guards } from "../src/middlewares/guards";
import { createGateway } from "../src/app";

afterEach(() => vi.unstubAllEnvs());
// แต่ละกรณีเรียกเพื่อสร้าง Express เล็ก ๆ → guards ตั้ง clientIp → ตอบ JSON ให้ Supertest ตรวจ
function ipApplication() {
  const app = express();
  app.use(guards);
  app.get("/", (req, res) => res.json({ ip: res.locals.clientIp, forwarded: req.get("x-vercel-forwarded-for") }));
  return app;
}
describe("Vercel entry configuration and client IP", () => {
  it("requires HTTPS frontend configuration when running on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("APP_URL", "http://localhost:5173");
    expect(() => createGateway()).toThrow("HTTPS");
  });
  it("uses the platform IP only on Vercel and strips forwarding before proxying", async () => {
    vi.stubEnv("VERCEL", "0");
    const local = await request(ipApplication()).get("/").set("x-vercel-forwarded-for", "198.51.100.10");
    expect(local.body.ip).not.toBe("198.51.100.10");
    vi.stubEnv("VERCEL", "1");
    const hosted = await request(ipApplication()).get("/").set("x-vercel-forwarded-for", "198.51.100.10");
    expect(hosted.body.ip).toBe("198.51.100.10");
    expect(hosted.body.forwarded).toBeUndefined();
    const invalid = await request(ipApplication()).get("/").set("x-vercel-forwarded-for", "spoofed, 198.51.100.10");
    expect(invalid.body.ip).not.toContain("spoofed");
  });
});
