import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
// routes/index.ts ส่ง action/จำนวนสูงสุด/ช่วงวินาที → คืน Middleware ให้ Express เรียกก่อน Controller
export function databaseRateLimit(
  action: string,
  limit: number,
  windowSeconds: number,
) {
  return async function limitRequest( // รับ Request จริง → นับคำขอใน DB → ผ่านให้ next หรือโยน 429 เข้า errorHandler
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const window = Math.floor(Date.now() / (windowSeconds * 1000));
    const identity = // สร้างลิงก์นับต่อ user จาก Session; Login/Register นับต่อ IP ที่ Gateway ส่งใน x-client-ip
      action === "create"
        ? String(res.locals.user.id)
        : req.get("x-client-ip") || req.ip || "unknown";
    const id = createHash("sha256") // รวม action+ตัวตน+ช่วงเวลาเป็น key เดียว ใช้ค้น/สร้างแถว RateLimit
      .update(action + ":" + identity + ":" + window)
      .digest("hex");
    // upsert increment เป็น atomic ใน DB จึงใช้หลาย process ได้
    const operation = {
      where: { id },
      create: {
        id,
        count: 1,
        expiresAt: new Date((window + 1) * windowSeconds * 1000),
      },
      update: { count: { increment: 1 } },
    };
    let bucket;
    try {
      bucket = await prisma.rateLimit.upsert(operation); // ไม่มีแถวสร้าง count=1; มีแล้วเพิ่ม count และคืนยอดล่าสุด
    } catch (error) {
      // DB อาจชน UNIQUE เมื่อหลายคำขอเปิด bucket ใหม่พร้อมกัน ให้ retry หลัง rollback
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      )
        bucket = await prisma.rateLimit.upsert(operation);
      else throw error;
    }
    if (bucket.count > limit) { // เกินโควตาตอบ 429 ไม่ไป Controller; Retry-After แจ้งเวลารอให้ผู้เรียก
      res.setHeader("Retry-After", windowSeconds);
      throw new HttpError(
        429,
        "RATE_LIMITED",
        "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่",
      );
    }
    next(); // ไม่เกินโควตา → Controller ของ Route ทำงานต่อ เช่น register/login/create
  };
}
