// ทดสอบ PATCH โปรไฟล์ผ่าน app/Controller จริง; Mock Prisma เพื่อเช็กว่าเลือกเจ้าของจาก Cookie ไม่ใช่ข้อมูลที่ผู้ใช้ส่ง
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    user: { update: vi.fn() },
    session: { findUnique: vi.fn() },
    rateLimit: { upsert: vi.fn() },
  },
}));
import { prisma } from "../src/lib/prisma";
import { app } from "../src/app";
const key = "unit-test-secret-only-not-for-deployment";
const user = {
  id: "7b0cdcef-4da0-43b8-a546-f79c4a7a4411",
  email: "profile@example.test",
  name: "ชื่อเดิม",
};
const token = "short_session=" + "a".repeat(64);

// แต่ละ it ส่ง Body/Cookie/Origin มา → Supertest เข้า /api/auth/me → คืน Response ให้ expect ตรวจ
function patch(
  body: unknown,
  cookie = token,
  origin = "http://localhost:5173",
) {
  return request(app)
    .patch("/api/auth/me")
    .set("x-internal-key", key)
    .set("Origin", origin)
    .set("Cookie", cookie)
    .send(body);
}
beforeEach(() => { // เตรียม Mock Session ที่ยังไม่หมดอายุและผล UPDATE สำหรับแต่ละกรณี
  vi.resetAllMocks();
  vi.mocked(prisma.session.findUnique).mockResolvedValue({
    tokenHash: "hash",
    userId: user.id,
    user,
    expiresAt: new Date(Date.now() + 60000),
  } as never);
  vi.mocked(prisma.user.update).mockResolvedValue({
    ...user,
    name: "ชื่อใหม่",
  } as never);
});
describe("Edit own display name", () => {
  // ส่งชื่อมีช่องว่างพร้อม Header ปลอม → Controller trim → updateUserName ใช้ Session owner → ตรวจ query/JSON
  it("updates only the session owner, trims the name and returns safe fields", async () => {
    const response = await patch({ name: "  ชื่อใหม่  " }).set(
      "x-user-id",
      "another-user",
    );
    expect(response.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: user.id },
      data: { name: "ชื่อใหม่" },
      select: { id: true, name: true, email: true },
    });
    expect(response.body).toEqual({ user: { ...user, name: "ชื่อใหม่" } });
  });
  it("rejects requests without a session", async () => {
    expect((await patch({ name: "ชื่อใหม่" }, "")).status).toBe(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it("rejects expired sessions", async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      user,
      expiresAt: new Date(0),
    } as never);
    expect((await patch({ name: "ชื่อใหม่" })).status).toBe(401);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it.each(["", "   ", "x".repeat(81), null, 42])(
    "rejects an invalid name: %s",
    async (name) => {
      expect((await patch({ name })).status).toBe(400);
      expect(prisma.user.update).not.toHaveBeenCalled();
    },
  );
  it("rejects account IDs and other fields supplied by a caller", async () => {
    expect(
      (
        await patch({
          name: "ชื่อใหม่",
          id: "other-user",
          email: "other@example.test",
        })
      ).status,
    ).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it("rejects another Origin and direct unauthenticated internal access", async () => {
    expect(
      (await patch({ name: "ชื่อใหม่" }, token, "https://other.example"))
        .status,
    ).toBe(403);
    expect(
      (await request(app).patch("/api/auth/me").send({ name: "ชื่อใหม่" }))
        .status,
    ).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
