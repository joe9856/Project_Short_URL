import { z } from "zod";
// dateRange ใช้ตรวจ YYYY-MM-DD และวันที่มีอยู่จริง; ไม่ผ่านโยนให้ controller.stats ตอบ INVALID_DATE_RANGE
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + "T00:00:00Z");
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  });
// dateRange/statistics ส่ง Date มา → คืนข้อความวันที่ไทย YYYY-MM-DD เพื่อจัดช่วงเริ่มต้นและเติมวันในกราฟ
export function bangkokDay(date: Date) {
  return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}
// controller.stats ส่ง from/to จาก query → วันที่เที่ยงคืนไทย → คืน { start, end } ให้ statistics กรอง clickedAt
export function dateRange(from?: string, to?: string) {
  const endDay = to ? dateSchema.parse(to) : bangkokDay(new Date());
  const end = new Date(endDay + "T00:00:00+07:00");
  end.setUTCDate(end.getUTCDate() + 1); // เลื่อน end ไปวันถัดไป เพื่อ query แบบ < end ยังรวมทั้งวันที่ to
  const start = from
    ? new Date(dateSchema.parse(from) + "T00:00:00+07:00")
    : new Date(end.getTime() - 30 * 86400000);
  if (start >= end || end.getTime() - start.getTime() > 366 * 86400000)
    throw new Error("INVALID_DATE_RANGE");
  return { start, end }; // ไม่ส่งค่ามาใช้ 30 วัน; ช่วงย้อนหลัง/เกิน 366 วันจะ throw ก่อนคืนค่า
}
