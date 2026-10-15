import { z } from "zod";
import { prisma } from "../lib/prisma";
import { config } from "../lib/config";
import { internalPost, HttpError } from "../lib/http";
import { bangkokDay } from "../lib/dates";
// controller.visit ตรวจ event จาก Link.redirectDestination; UUID/วันที่/อุปกรณ์ต้องตรงก่อนส่งให้ recordClick
export const eventSchema = z
  .object({
    eventId: z.string().uuid(),
    linkId: z.string().uuid(),
    ownerId: z.string().uuid(),
    clickedAt: z.string().datetime(),
    referrerHost: z.string().min(1).max(253),
    deviceType: z.enum(["desktop", "mobile", "tablet"]),
  })
  .strict();
// controller.visit ส่ง event ที่ตรวจแล้ว → INSERT click_events → คืน { recorded: true } ให้ Link ยืนยันก่อน Redirect
export async function recordClick(event: z.infer<typeof eventSchema>) {
  try {
    await prisma.clickEvent.create({
      data: { ...event, clickedAt: new Date(event.clickedAt) },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      // ตรวจเนื้อหาเดิมด้วย ไม่ยอมให้ eventId เดิมถูกใช้กับคลิกคนละรายการ
      const existing = await prisma.clickEvent.findUnique({ // eventId ซ้ำจาก Retry: ต้องตรวจว่าเป็นเหตุการณ์เดิมจริง ไม่เพิ่มแถวซ้ำ
        where: { eventId: event.eventId },
      });
      if (
        !existing ||
        existing.linkId !== event.linkId ||
        existing.ownerId !== event.ownerId ||
        existing.clickedAt.toISOString() !== event.clickedAt ||
        existing.deviceType !== event.deviceType ||
        existing.referrerHost !== event.referrerHost
      )
        throw new HttpError(
          409,
          "EVENT_CONFLICT",
          "eventId นี้มีข้อมูลต่างกัน",
        );
    } else throw error;
  }
  return { recorded: true };
}
// controller.counts รับเจ้าของและ id ลิงก์จาก Link.listLinks → GROUP BY linkId → คืน { counts } ให้ Link เติม clicks ใน History
export async function clickCounts(ownerId: string, linkIds: string[]) {
  const groups = await prisma.clickEvent.groupBy({
    by: ["linkId"],
    where: { ownerId, linkId: { in: linkIds } },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const group of groups) counts[group.linkId] = group._count._all;
  return { counts };
}
// controller.stats ส่ง ownerId/start/end/อาจมี linkId → ขอข้อมูลลิงก์จาก Link → query click_events → คืน { stats } ให้ Frontend
export async function statistics(
  ownerId: string,
  start: Date,
  end: Date,
  linkId?: string,
  requestId?: string,
) {
  if (linkId) // สถิติลิงก์เดียวต้องให้ Link.controller.ownership ยืนยันเจ้าของก่อน; ไม่พบจะโยน 404
    await internalPost(
      config.linkUrl + "/internal/links/" + linkId + "/ownership",
      { userId: ownerId },
      undefined,
      requestId,
    );
  const summary = z
    .object({ totalLinks: z.number(), activeLinks: z.number() })
    .parse(
      await internalPost(
        config.linkUrl + "/internal/links/summary", // Link.controller.summary → linkSummary → จำนวนลิงก์ไว้ทำการ์ด
        { userId: ownerId },
        undefined,
        requestId,
      ),
    );
  const where = {
    ownerId,
    ...(linkId ? { linkId } : {}),
    clickedAt: { gte: start, lt: end }, // รวม start แต่ไม่รวม end (เที่ยงคืนถัดจากวันที่สุดท้ายที่เลือก)
  };
  // ใช้ snapshot เดียวกัน เพื่อให้ยอดรวม/กราฟตรงกันแม้มีคลิกใหม่ระหว่าง query
  const snapshot = await prisma.$transaction(
    async function readStatistics(database) { // Prisma ส่ง transaction client มาให้อ่านข้อมูลคลิกชุดเดียวกัน
      // SQL จัดกลุ่มวันตามเวลาไทย; $queryRaw แบบ tagged template ให้ Prisma ส่งค่าตัวแปรเป็น SQL parameter
      const daily = linkId
        ? await database.$queryRaw<
            { date: string; clicks: bigint }[]
          >`SELECT to_char("clickedAt" AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS date, COUNT(*) AS clicks FROM click_events WHERE "ownerId"=${ownerId} AND "linkId"=${linkId} AND "clickedAt">=${start} AND "clickedAt"<${end} GROUP BY date ORDER BY date`
        : await database.$queryRaw<
            { date: string; clicks: bigint }[]
          >`SELECT to_char("clickedAt" AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS date, COUNT(*) AS clicks FROM click_events WHERE "ownerId"=${ownerId} AND "clickedAt">=${start} AND "clickedAt"<${end} GROUP BY date ORDER BY date`;
      const totalClicks = await database.clickEvent.count({ where });
      const devices = await database.clickEvent.groupBy({
        by: ["deviceType"],
        where,
        _count: { _all: true },
        orderBy: { deviceType: "asc" },
      });
      const sources = await database.clickEvent.groupBy({
        by: ["referrerHost"],
        where,
        _count: { _all: true },
        orderBy: { _count: { referrerHost: "desc" } },
        take: 20,
      });
      return { daily, totalClicks, devices, sources }; // คืนจาก callback → snapshot ของ $transaction → ประกอบ JSON ด้านล่าง
    },
    { isolationLevel: "RepeatableRead" },
  );
  const { daily, totalClicks, devices, sources } = snapshot;
  const clicksByDate = []; // เติมทุกวันในช่วงที่เลือก รวมวันที่ไม่มีคลิกเป็น 0 ให้กราฟ Frontend ต่อเนื่อง
  for (
    let cursor = new Date(start);
    cursor < end;
    cursor = new Date(cursor.getTime() + 86400000)
  ) {
    const date = bangkokDay(cursor);
    const value = daily.find((day) => day.date === date);
    clicksByDate.push({ date, clicks: value ? Number(value.clicks) : 0 });
  }
  // คืนรูปแบบตรง frontend/types/api.ts Stats → Controller res.json → frontend Analytics.setStats → กราฟ/ตาราง
  return {
    stats: {
      ...summary,
      totalClicks,
      clicksByDate,
      devices: devices.map((item) => ({
        name: item.deviceType,
        clicks: item._count._all,
      })),
      sources: sources.map((item) => ({
        name: item.referrerHost,
        clicks: item._count._all,
      })),
      range: {
        from: bangkokDay(start),
        to: bangkokDay(new Date(end.getTime() - 1)),
        timezone: "Asia/Bangkok",
      },
    },
  };
}
