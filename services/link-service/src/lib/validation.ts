import { randomInt } from "node:crypto";
import { z } from "zod";
import { codePattern, isReservedName } from "@short/routing";
export { codePattern } from "@short/routing";
// createSchema และ redirectDestination ส่ง URL มา → แยก URL/ตรวจ HTTP(S) และไม่มีบัญชีฝัง → คืน boolean ไม่ส่ง HTTP ออกไป
export function validDestination(value: string) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
// controller.create ใช้ parse(req.body): ตรวจ URL/alias/หมดอายุ → คืน input ให้ createLink; ไม่ผ่านโยน ZodError
export const createSchema = z
  .object({
    originalUrl: z
      .string()
      .trim()
      .max(8192)
      .refine(validDestination, "ใช้ URL แบบ HTTP/HTTPS ที่ไม่มีรหัสผ่าน"),
    alias: z
      .string()
      .regex(codePattern, "Alias ต้องมี 3–32 ตัวอักษร A-Z a-z 0-9 _ -")
      .refine((alias) => !isReservedName(alias), "ชื่อนี้ระบบใช้แล้ว กรุณาเลือกชื่ออื่น")
      .optional(),
    expiresAt: z
      .string()
      .datetime({ offset: true })
      .refine(
        (value) => new Date(value) > new Date(),
        "วันหมดอายุต้องอยู่ในอนาคต",
      )
      .optional(),
  })
  .strict();
// controller.update ใช้ parse(req.body): ยอมรับสถานะ/หมดอายุเท่านั้น และต้องมีอย่างน้อยหนึ่ง field → updateLink
export const updateSchema = z
  .object({
    isActive: z.boolean().optional(),
    expiresAt: z
      .string()
      .datetime({ offset: true })
      .refine(
        (value) => new Date(value) > new Date(),
        "วันหมดอายุต้องอยู่ในอนาคต",
      )
      .nullable()
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
// createLink เรียกเมื่อไม่มี alias → สุ่มอักษร/ตัวเลข 8 ตัวและไม่เป็นชื่อสงวน → คืน code ไปบันทึกใน DB
// ไม่ได้ตรวจรหัสซ้ำในฟังก์ชันนี้; Unique ของ DB และ Retry ใน createLink รับผิดชอบรหัสชนกัน
export function generateCode() {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code: string;
  do {
    code = "";
    for (let i = 0; i < 8; i++) code += alphabet[randomInt(alphabet.length)];
  } while (isReservedName(code));
  return code;
}
// publicLink ใช้คำนวณสถานะ; redirectDestination ใช้หยุดลิงก์ปิด/หมดอายุ → คืน true เมื่อใช้ไม่ได้
export function linkUnavailable(link: {
  isActive: boolean;
  expiresAt: Date | null;
}) {
  return (
    !link.isActive || (link.expiresAt !== null && link.expiresAt <= new Date())
  );
}
// redirectDestination ส่ง User-Agent → คืนชื่อกลุ่มอุปกรณ์ใส่ event ให้ Analytics เก็บและ groupBy
export function getDevice(userAgent: string) {
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}
// redirectDestination ส่ง Referer → คืน hostname หรือ direct → ใส่ referrerHost ใน event ให้ Analytics นับแหล่งที่มา
export function getReferrer(value?: string) {
  try {
    return value ? new URL(value).hostname.slice(0, 253) : "direct";
  } catch {
    return "direct";
  }
}
