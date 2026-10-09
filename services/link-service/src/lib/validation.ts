import { randomInt } from "node:crypto";
import { z } from "zod";
export const codePattern = /^[A-Za-z0-9_-]{3,32}$/;
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
export function generateCode() {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += alphabet[randomInt(alphabet.length)];
  return code;
}
export function linkUnavailable(link: {
  isActive: boolean;
  expiresAt: Date | null;
}) {
  return (
    !link.isActive || (link.expiresAt !== null && link.expiresAt <= new Date())
  );
}
export function getDevice(userAgent: string) {
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}
export function getReferrer(value?: string) {
  try {
    return value ? new URL(value).hostname.slice(0, 253) : "direct";
  } catch {
    return "direct";
  }
}
