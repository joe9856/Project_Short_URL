import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { config } from "../lib/config";
import { internalPost } from "../lib/http";
// ตรวจ JSON { user } ที่ Auth controller.me ตอบกลับ ก่อนใช้บัญชีนี้ใน Controller ของ Service
const identitySchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
});
// Router เรียกก่อน API ส่วนตัว → internalPost ส่ง Cookie ไป Auth getUserFromSession → เก็บ user ให้ Controller
export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // ให้ Auth ตรวจ cookie อีกครั้ง ก่อนใช้ userId ใน query ของบริการนี้
  const result = await internalPost(
    config.authUrl + "/internal/sessions/verify",
    {},
    req.headers.cookie,
    String(res.getHeader("X-Request-Id")),
  );
  res.locals.user = identitySchema.parse(result).user; // Controller อ่าน res.locals.user.id ไปกรองข้อมูลเจ้าของใน DB
  next(); // Session ผ่านจึงเรียก Handler ถัดไป; ถ้า internalPost/parse โยนข้อผิดพลาดจะไม่ถึงบรรทัดนี้
}
