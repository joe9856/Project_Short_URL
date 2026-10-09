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
export async function createLink(
  userId: string,
  input: z.infer<typeof createSchema>,
) {
  // UNIQUE ใน DB เป็นด่านสุดท้าย ป้องกันชนกันเมื่อสร้างพร้อมกัน
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await prisma.link.create({
        data: {
          userId,
          createdAt: new Date(),
          code: input.alias || generateCode(),
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
        if (input.alias)
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
export async function ownedLink(id: string, userId: string) {
  const link = await prisma.link.findFirst({ where: { id, userId } });
  if (!link) throw new HttpError(404, "NOT_FOUND", "ไม่พบลิงก์");
  return link;
}
export function linkFilter(
  userId: string,
  search: string,
  status: string,
): Prisma.LinkWhereInput {
  const where: Prisma.LinkWhereInput = { userId };
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
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.link.count({ where }),
  ]);
  const result = z
    .object({ counts: z.record(z.number()) })
    .parse(
      await internalPost(
        config.analyticsUrl + "/internal/click-counts",
        { ownerId: userId, linkIds: links.map((link) => link.id) },
        undefined,
        requestId,
      ),
    );
  return {
    links: links.map((link) => ({
      ...publicLink(link),
      clicks: result.counts[link.id] || 0,
    })),
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
  };
}
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
      expiresAt:
        input.expiresAt === undefined
          ? undefined
          : input.expiresAt === null
            ? null
            : new Date(input.expiresAt),
    },
  });
}
export async function generateQr(link: Link, format: "png" | "svg") {
  const shortUrl = config.appUrl + shortLinkPath(link.code);
  const options = { margin: 4, width: 512, errorCorrectionLevel: "M" as const };
  if (format === "svg")
    return QRCode.toString(shortUrl, { ...options, type: "svg" });
  return QRCode.toBuffer(shortUrl, { ...options, type: "png" });
}
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
  if (!head) {
    const event = {
      eventId: randomUUID(),
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
              config.analyticsUrl + "/internal/visits",
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
    if (!recorded)
      throw new HttpError(
        503,
        "CLICK_NOT_CONFIRMED",
        "ยังยืนยันการบันทึกคลิกไม่ได้ กรุณาลองอีกครั้ง",
      );
  }
  return link.originalUrl;
}
export async function linkSummary(userId: string) {
  const [totalLinks, activeLinks] = await prisma.$transaction([
    prisma.link.count({ where: { userId } }),
    prisma.link.count({ where: linkFilter(userId, "", "active") }),
  ]);
  return { totalLinks, activeLinks };
}
