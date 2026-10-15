// Vitest เรียก Service/Route Analytics ด้วย Prisma และ fetch แบบ Mock; ตรวจ event/การนับ/วันที่ ไม่ใช้ DB จริง
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    clickEvent: { create: vi.fn(), findUnique: vi.fn(), groupBy: vi.fn() },
  },
}));
import { prisma } from "../src/lib/prisma";
import { app } from "../src/app";
import {
  recordClick,
  eventSchema,
  clickCounts,
} from "../src/services/analytics";
import { bangkokDay, dateRange } from "../src/lib/dates";
const event = {
  eventId: "7b0cdcef-4da0-43b8-a546-f79c4a7a4411",
  ownerId: "5b0cdcef-4da0-43b8-a546-f79c4a7a4411",
  linkId: "3b0cdcef-4da0-43b8-a546-f79c4a7a4411",
  clickedAt: "2026-10-09T00:00:00.000Z",
  deviceType: "desktop" as const,
  referrerHost: "direct",
};
beforeEach(() => vi.clearAllMocks()); // ล้างการเรียก Mock ก่อนกรณีถัดไป
afterEach(() => vi.unstubAllGlobals()); // คืน fetch/global ที่กรณีทดสอบเคยแทนไว้
describe("Analytics service", () => {
  // event → recordClick → Mock INSERT; ส่ง eventId เดิมซ้ำและข้อมูลเดิมต้องยังได้ recorded:true โดยไม่เพิ่มแถว
  it("persists before acknowledging and accepts exact replay", async () => {
    vi.mocked(prisma.clickEvent.create).mockResolvedValue({
      ...event,
      id: "x",
      clickedAt: new Date(event.clickedAt),
    });
    expect(await recordClick(event)).toEqual({ recorded: true });
    vi.mocked(prisma.clickEvent.create).mockRejectedValue({ code: "P2002" });
    vi.mocked(prisma.clickEvent.findUnique).mockResolvedValue({
      ...event,
      id: "x",
      clickedAt: new Date(event.clickedAt),
    });
    expect(await recordClick(event)).toEqual({ recorded: true });
  });
  it("rejects mismatched event replay and DB failure", async () => {
    vi.mocked(prisma.clickEvent.create).mockRejectedValue({ code: "P2002" });
    vi.mocked(prisma.clickEvent.findUnique).mockResolvedValue({
      ...event,
      id: "x",
      ownerId: "other",
      clickedAt: new Date(event.clickedAt),
    });
    await expect(recordClick(event)).rejects.toMatchObject({ status: 409 });
    vi.mocked(prisma.clickEvent.create).mockRejectedValue(new Error("DB down"));
    await expect(recordClick(event)).rejects.toThrow("DB down");
  });
  // ownerId/linkIds → clickCounts → Mock GROUP BY → ตรวจ { counts } และเงื่อนไขเจ้าของที่ส่งไป Prisma
  it("filters counts by owner in a single batch", async () => {
    vi.mocked(prisma.clickEvent.groupBy).mockResolvedValue([
      { linkId: event.linkId, _count: { _all: 3 } },
    ] as never);
    expect(await clickCounts(event.ownerId, [event.linkId])).toEqual({
      counts: { [event.linkId]: 3 },
    });
    expect(prisma.clickEvent.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: event.ownerId, linkId: { in: [event.linkId] } },
      }),
    );
  });
  it("validates private events and rejects missing keys", async () => {
    expect(() =>
      eventSchema.parse({ ...event, deviceType: "unknown" }),
    ).toThrow();
    expect(
      (await request(app).post("/internal/visits").send(event)).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/internal/visits")
          .set("x-internal-key", "unit-test-secret-only-not-for-deployment")
          .send({})
      ).status,
    ).toBe(400);
  });
  // from/to → dateRange → start/end UTC; ตรวจว่าเส้นแบ่งวันไทยตรงและ end เป็นวันถัดไปแบบไม่รวมขอบ
  it("uses Bangkok day boundaries with an exclusive end", () => {
    expect(bangkokDay(new Date("2026-10-08T17:00:00Z"))).toBe("2026-10-09");
    const range = dateRange("2026-10-09", "2026-10-09");
    expect(range.start.toISOString()).toBe("2026-10-08T17:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-09T17:00:00.000Z");
    expect(() => dateRange("2026-02-30", "2026-03-01")).toThrow();
    expect(() => dateRange("2026-10-10", "2026-10-01")).toThrow();
  });
  it("denies protected endpoints when Auth is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("auth down")));
    expect(
      (
        await request(app)
          .get("/api/stats")
          .set("x-internal-key", "unit-test-secret-only-not-for-deployment")
      ).status,
    ).toBe(503);
  });
});
