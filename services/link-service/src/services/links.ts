import { z } from "zod";
import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { shortLinkPath } from "@short/routing";
import type { Link, Prisma } from "../../generated/client";
import { prisma } from "../lib/prisma";
import { config } from "../lib/config";
import { HttpError, internalPost } from "../lib/http";
import {
  createSchema,
  generateCode,
  linkUnavailable,
  validDestination,
  getDevice,
  getReferrer,
} from "../lib/validation";
// Controller create/detail/update และ listLinks ส่งแถวจาก DB มา → เพิ่ม shortUrl/status → คืน object สำหรับ JSON ไป Frontend
export function publicLink(link: Link) {
  return {
    ...link,
    shortUrl: config.appUrl + shortLinkPath(link.code),
    status: linkUnavailable(link)
      ? link.isActive
        ? "expired"
        : "disabled"
      : "active",
  };
}
// controller.create ส่ง userId จาก Session และ Body ที่ createSchema ตรวจแล้ว → Prisma INSERT → คืนแถวใหม่ให้ publicLink
export async function createLink(
  userId: string,
  input: z.infer<typeof createSchema>,
) {
  // UNIQUE ใน DB เป็นด่านสุดท้าย ป้องกันชนกันเมื่อสร้างพร้อมกัน
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await prisma.link.create({ // บันทึกสำเร็จจบฟังก์ชันทันที; DB ไม่ได้เก็บ shortUrl เต็ม แต่เก็บ code คู่ originalUrl
        data: {
          userId,
          createdAt: new Date(),
          code: input.alias || generateCode(), // มี alias ใช้ค่าผู้ใช้; ไม่มีเรียก lib/validation.ts generateCode สุ่มรหัส
          originalUrl: input.originalUrl,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        if (input.alias) // P2002 คือชนค่า Unique; alias ผู้ใช้ซ้ำให้ 409 ส่วนรหัสสุ่มซ้ำวนลองใหม่ได้สูงสุด 8 รอบ
          throw new HttpError(409, "ALIAS_EXISTS", "Alias นี้ถูกใช้งานแล้ว");
      } else {
        throw error;
      }
    }
  }
  throw new HttpError(
    503,
    "CODE_EXHAUSTED",
    "สร้างรหัสไม่สำเร็จ กรุณาลองอีกครั้ง",
  );
}
// detail/update/qr/ownership ส่ง id+เจ้าของมา → Prisma ค้นให้ตรงทั้งคู่ → คืน Link หรือโยน 404 ไป errorHandler
export async function ownedLink(id: string, userId: string) {
  const link = await prisma.link.findFirst({ where: { id, userId } });
  if (!link) throw new HttpError(404, "NOT_FOUND", "ไม่พบลิงก์");
  return link;
}
// listLinks/linkSummary ส่งเจ้าของ/คำค้น/สถานะ → ประกอบ where ให้ Prisma; ฟังก์ชันนี้ยังไม่ได้ query DB เอง
export function linkFilter(
  userId: string,
  search: string,
  status: string,
): Prisma.LinkWhereInput {
  const where: Prisma.LinkWhereInput = { userId }; // เริ่มด้วยเจ้าของเสมอ เพื่อไม่ให้ผลค้นหารวมลิงก์ของคนอื่น
  if (search)
    where.OR = [
      { originalUrl: { contains: search, mode: "insensitive" } },
      { code: { contains: search } },
    ];
  if (status === "active") {
    where.isActive = true;
    where.AND = [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    ];
  }
  if (status === "disabled") where.isActive = false;
  if (status === "expired") {
    where.isActive = true;
    where.expiresAt = { lte: new Date() };
  }
  return where;
}
// controller.list ส่งเงื่อนไขจาก History → query ลิงก์/จำนวน → ขอคลิกจาก Analytics → คืน { links, pagination } ให้ Controller
export async function listLinks(
  userId: string,
  page: number,
  pageSize: number,
  search: string,
  status: string,
  requestId?: string,
) {
  const where = linkFilter(userId, search, status);
  const [links, total] = await prisma.$transaction([
    prisma.link.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize, // ข้ามรายการก่อนหน้าที่เลือก เช่น หน้า 2 ขนาด 10 ข้าม 10 แถว
      take: pageSize, // จำนวนแถวในหน้านี้ ไม่ดึงทุกลิงก์พร้อมกัน
    }),
    prisma.link.count({ where }),
  ]);
  const result = z
    .object({ counts: z.record(z.number()) })
    .parse(
      await internalPost(
        config.analyticsUrl + "/internal/click-counts", // HTTP → Analytics controller.counts → clickCounts คืน { counts: { linkId: จำนวน } }
        { ownerId: userId, linkIds: links.map((link) => link.id) },
        undefined,
        requestId,
      ),
    );
  return {
    links: links.map((link) => ({
      ...publicLink(link),
      clicks: result.counts[link.id] || 0, // นำยอดจาก Analytics จับคู่ id กับแต่ละลิงก์; ไม่มียอดใช้ 0
    })),
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
  };
}
// controller.update ส่ง id/user/input → ownedLink ตรวจสิทธิ์ก่อน → Prisma UPDATE → คืนแถวให้ publicLink และ Frontend
export async function updateLink(
  id: string,
  userId: string,
  input: { isActive?: boolean; expiresAt?: string | null },
) {
  await ownedLink(id, userId);
  return prisma.link.update({
    where: { id },
    data: {
      isActive: input.isActive,
      expiresAt: // undefined ไม่แก้ field เดิม; null ล้างวันหมดอายุ; string แปลงเป็น Date เพื่อบันทึก
        input.expiresAt === undefined
          ? undefined
          : input.expiresAt === null
            ? null
            : new Date(input.expiresAt),
    },
  });
}
// controller.qr ส่ง Link/format → ประกอบ Short URL → qrcode เข้ารหัส → คืน SVG string หรือ PNG Buffer ให้ res.send
// สร้างภาพเมื่อขอ ไม่ได้ INSERT รูปลง DB; QR เก็บ Short URL เพื่อให้การเปิดผ่าน redirectDestination และ Analytics
export async function generateQr(link: Link,  //รับข้อมูลแถวลิงก์ที่ค้นพบ
  format: "png" | "svg") { //TypeScript ระบุว่ารับได้สองค่านี้
  const shortUrl = config.appUrl + shortLinkPath(link.code); //ประกอบโดเมนเว็บกับรหัสลิงก์
  const options = { margin: 4, width: 512, errorCorrectionLevel: "M" as const };
  if (format === "svg")
    return QRCode.toString(shortUrl, { ...options, type: "svg" }); //ข้อความ SVG ซึ่งเป็นคำอธิบายภาพแบบเวกเตอร์
  return QRCode.toBuffer(shortUrl, { ...options, type: "png" }); //Buffer — ข้อมูลไบนารีของไฟล์ภาพ PNG
}
// controller.redirect ส่ง code/ชนิดคำขอ/Headers → ค้น code → ตรวจลิงก์ → บันทึกคลิก → คืน originalUrl ให้ res.redirect(302)
export async function redirectDestination(
  code: string,
  head: boolean,
  userAgent: string,
  referrer?: string,
  requestId?: string,
) {
  const link = await prisma.link.findUnique({ where: { code } });
  if (!link) throw new HttpError(404, "NOT_FOUND", "ไม่พบลิงก์");
  if (linkUnavailable(link))
    throw new HttpError(
      410,
      "LINK_UNAVAILABLE",
      "ลิงก์นี้ปิดใช้งานหรือหมดอายุแล้ว",
    );
  if (!validDestination(link.originalUrl))
    throw new HttpError(410, "INVALID_DESTINATION", "ลิงก์ปลายทางไม่ถูกต้อง");
  if (!head) { // HEAD ใช้ตรวจข้อมูลโดยไม่บันทึกคลิก; GET รวมเปิดจาก QR จะเข้า block นี้
    const event = {
      eventId: randomUUID(), // สร้างครั้งเดียวก่อน Retry; Analytics ใช้ Unique eventId กันการนับคำขอเดิมซ้ำ
      linkId: link.id,
      ownerId: link.userId,
      clickedAt: new Date().toISOString(),
      deviceType: getDevice(userAgent),
      referrerHost: getReferrer(referrer),
    };
    // Retry ใช้ eventId เดิม Analytics insert แบบ idempotent จึงไม่บวกซ้ำ
    let recorded = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = z
          .object({ recorded: z.literal(true) })
          .parse(
            await internalPost(
              config.analyticsUrl + "/internal/visits", // HTTP → Analytics controller.visit → recordClick → { recorded: true }
              event,
              undefined,
              requestId,
            ),
          );
        recorded = result.recorded;
        break;
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 503) throw error;
      }
    }
    if (!recorded) // ยืนยันคลิกไม่ได้หลังลองใหม่ → โยน 503 ไม่ Redirect ในรอบนี้
      throw new HttpError(
        503,
        "CLICK_NOT_CONFIRMED",
        "ยังยืนยันการบันทึกคลิกไม่ได้ กรุณาลองอีกครั้ง",
      );
  }
  return link.originalUrl; // Controller ใส่ URL นี้ใน Location ของ 302; Browser ไปโหลดเว็บปลายทางเอง
}
// controller.summary รับ userId จาก Analytics → นับลิงก์ทั้งหมด/ที่ใช้งาน → คืนข้อมูลให้ statistics รวมใน { stats }
export async function linkSummary(userId: string) {
  const [totalLinks, activeLinks] = await prisma.$transaction([
    prisma.link.count({ where: { userId } }),
    prisma.link.count({ where: linkFilter(userId, "", "active") }),
  ]);
  return { totalLinks, activeLinks };
}
