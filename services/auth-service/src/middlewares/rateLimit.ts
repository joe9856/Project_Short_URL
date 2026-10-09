import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
export function databaseRateLimit(
  action: string,
  limit: number,
  windowSeconds: number,
) {
  return async function limitRequest(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const window = Math.floor(Date.now() / (windowSeconds * 1000));
    const identity =
      action === "create"
        ? String(res.locals.user.id)
        : req.get("x-client-ip") || req.ip || "unknown";
    const id = createHash("sha256")
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
      bucket = await prisma.rateLimit.upsert(operation);
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
    if (bucket.count > limit) {
      res.setHeader("Retry-After", windowSeconds);
      throw new HttpError(
        429,
        "RATE_LIMITED",
        "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่",
      );
    }
    next();
  };
}
