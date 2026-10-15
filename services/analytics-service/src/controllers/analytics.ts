import type { Request, Response } from "express";
import { z } from "zod";
import {
  eventSchema,
  recordClick,
  clickCounts,
  statistics,
} from "../services/analytics";
import { dateRange } from "../lib/dates";
import { HttpError } from "../lib/http";
// Link Service ส่งเหตุการณ์เปิดลิงก์ → eventSchema ตรวจ Body → recordClick บันทึก → 201 { recorded: true } กลับ Link
export async function visit(req: Request, res: Response) {
  res.status(201).json(await recordClick(eventSchema.parse(req.body)));
}
// Link.listLinks ส่ง ownerId/linkIds → ตรวจ UUID/จำนวน → clickCounts นับคลิก → { counts } กลับ Link เพื่อรวมรายการ
export async function counts(req: Request, res: Response) {
  const input = z
    .object({
      ownerId: z.string().uuid(),
      linkIds: z.array(z.string().uuid()).max(100),
    })
    .strict()
    .parse(req.body);
  res.json(await clickCounts(input.ownerId, input.linkIds));
}
// Analytics Component ส่ง from/to และอาจมี path id → dateRange → statistics → { stats } กลับ Component.setStats
export async function stats(req: Request, res: Response) {
  const query = z
    .object({ from: z.string().optional(), to: z.string().optional() })
    .strict()
    .parse(req.query);
  let range;
  try {
    range = dateRange(query.from, query.to); // วันที่ไทย → start/end ที่ใช้กรอง clickedAt; ช่วงไม่ถูกต้องตอบ 400
  } catch {
    throw new HttpError(
      400,
      "INVALID_DATE_RANGE",
      "เลือกวันที่ที่ถูกต้องและช่วงไม่เกิน 366 วัน",
    );
  }
  const linkId = req.params.id // ไม่มี id อ่านสถิติรวม; มี id ส่งให้ statistics ตรวจเจ้าของกับ Link Service ก่อน
    ? z.string().uuid().parse(req.params.id)
    : undefined;
  res.json(
    await statistics(
      res.locals.user.id,
      range.start,
      range.end,
      linkId,
      String(res.getHeader("X-Request-Id")),
    ),
  );
}
