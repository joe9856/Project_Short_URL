// Vitest รันไฟล์นี้: Supertest ส่ง Request เข้า app.ts/Route/Controller จริง แต่ Prisma เป็น Mock ไม่เขียน DB จริง
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import argon2 from "argon2";
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    user: { create: vi.fn(), findUnique: vi.fn() },
    session: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
    rateLimit: { upsert: vi.fn() },
  },
}));
import { prisma } from "../src/lib/prisma";
import { app } from "../src/app";
import {
  getUserFromSession,
  createSession,
  sessionCookie,
  loginUser,
} from "../src/services/auth";
const key = "unit-test-secret-only-not-for-deployment";
const user = {
  id: "7b0cdcef-4da0-43b8-a546-f79c4a7a4411",
  email: "test@example.com",
  name: "ทดสอบ",
};
beforeEach(() => { // ก่อนแต่ละกรณีล้างประวัติ Mock และเตรียม RateLimit ให้คำขอผ่านไปทดสอบ Controller
  vi.clearAllMocks();
  vi.mocked(prisma.rateLimit.upsert).mockResolvedValue({
    id: "rate",
    count: 1,
    expiresAt: new Date(),
  });
});
describe("Auth service", () => {
  it("health works independently and rejects direct internal access", async () => {
    expect((await request(app).get("/healthz")).status).toBe(200);
    expect((await request(app).post("/internal/sessions/verify")).status).toBe(
      403,
    );
  });
  it("validates registration and Origin", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/register")
          .set("x-internal-key", key)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/auth/register")
          .set("x-internal-key", key)
          .set("Origin", "http://localhost:5173")
          .send({ name: "x", email: "bad", password: "1" })
      ).status,
    ).toBe(400);
  });
  // POST register → Controller → registerUser → Mock Prisma; ตรวจ hash ที่ส่งไป DB ด้วย Argon2 จริง
  it("hashes passwords with Argon2id without exposing the hash", async () => {
    vi.mocked(prisma.user.create).mockResolvedValue({
      ...user,
      passwordHash: "unused",
      createdAt: new Date(),
    });
    const response = await request(app)
      .post("/api/auth/register")
      .set("x-internal-key", key)
      .set("Origin", "http://localhost:5173")
      .send({ ...user, id: undefined, password: "password123" });
    expect(response.status).toBe(201);
    const input = vi.mocked(prisma.user.create).mock.calls[0][0]!;
    expect(input.data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(
      await argon2.verify(String(input.data.passwordHash), "password123"),
    ).toBe(true);
  });
  // createSession รับ userId → Mock session.create; ตรวจว่า token จริงไม่ใช่ค่าที่เก็บ และ Cookie มีข้อกำหนด
  it("stores hashed tokens and sets protected cookies", async () => {
    vi.mocked(prisma.session.create).mockResolvedValue({
      tokenHash: "x",
      userId: user.id,
      expiresAt: new Date(),
    });
    const token = await createSession(user.id);
    expect(token).toHaveLength(64);
    const input = vi.mocked(prisma.session.create).mock.calls[0][0]!;
    expect(input.data.tokenHash).not.toBe(token);
    expect(sessionCookie(token)).toContain("HttpOnly");
    expect(sessionCookie(token)).toContain("SameSite=Lax");
  });
  // ส่ง Cookie ว่าง/Session หมดอายุเข้า getUserFromSession → ต้อง reject 401 ให้ Controller ไม่คืนบัญชี
  it("rejects expired and missing sessions", async () => {
    await expect(getUserFromSession()).rejects.toMatchObject({ status: 401 });
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      tokenHash: "x",
      userId: user.id,
      expiresAt: new Date(0),
      user,
    } as never);
    await expect(
      getUserFromSession("short_session=" + "a".repeat(64)),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("uses generic credential errors", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    await expect(loginUser(user.email, "password123")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });
  it("returns 429 when database rate limit is exceeded", async () => {
    vi.mocked(prisma.rateLimit.upsert).mockResolvedValue({
      id: "rate",
      count: 100,
      expiresAt: new Date(),
    });
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .set("x-internal-key", key)
          .set("Origin", "http://localhost:5173")
          .send({ email: user.email, password: "password123" })
      ).status,
    ).toBe(429);
  });
});
