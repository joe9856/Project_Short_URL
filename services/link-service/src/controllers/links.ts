import type { Request, Response } from "express";
import { z } from "zod";
import { isReservedName } from "@short/routing";
import * as service from "../services/links";
import { codePattern, createSchema, updateSchema } from "../lib/validation";
import { HttpError } from "../lib/http";
// ตรวจ id จาก path และ query จาก History ก่อนส่งให้ Service; ผิดรูปแบบโยน ZodError → errorHandler ตอบ 400
const idSchema = z.string().uuid();
const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().max(200).default(""),
    status: z.enum(["all", "active", "disabled", "expired"]).default("all"),
  })
  .strict();
// CreateForm POST → requireSession ใส่ user → createSchema ตรวจ Body → createLink บันทึก DB → publicLink เพิ่ม URL/status
// 201 { link } → Gateway → frontend/api.ts → CreateForm.setLink → LinkResult
//Controller ตรวจข้อมูลและเรียก Service
export async function create(req: Request, res: Response) {
  res.status(201).json({
    link: service.publicLink(
      await service.createLink(
        res.locals.user.id, // เจ้าของจาก Session ไม่รับ userId ที่ผู้ใช้กรอกเอง
        createSchema.parse(req.body), // คืน object ที่ตรวจแล้วให้ createLink; ไม่ผ่านจะไม่บันทึก DB
      ),
    ),
  });
}
// History GET พร้อม query → listLinks รับ user/หน้า/คำค้น/สถานะ → { links, pagination } กลับ History.setData
export async function list(req: Request, res: Response) {
  const query = querySchema.parse(req.query);
  res.json(
    await service.listLinks(
      res.locals.user.id,
      query.page,
      query.pageSize,
      query.search,
      query.status,
      String(res.getHeader("X-Request-Id")),
    ),
  );
}
// LinkDetails GET id → ownedLink ตรวจ id+user ใน DB → publicLink → { link } กลับฟอร์มรายละเอียด
export async function detail(req: Request, res: Response) {
  res.json({
    link: service.publicLink(
      await service.ownedLink(
        idSchema.parse(req.params.id),
        res.locals.user.id,
      ),
    ),
  });
}
// History/LinkDetails PATCH → ตรวจ id/Body → updateLink ตรวจเจ้าของและบันทึก → { link } กลับผู้เรียกอัปเดต State
export async function update(req: Request, res: Response) {
  res.json({
    link: service.publicLink(
      await service.updateLink(
        idSchema.parse(req.params.id),
        res.locals.user.id,
        updateSchema.parse(req.body),
      ),
    ),
  });
}
// LinkResult img/ดาวน์โหลด GET → ownedLink ตรวจเจ้าของ → generateQr → ส่งภาพตรงให้ Browser ไม่ใช่ JSON
export async function qr(req: Request, res: Response) {
  const format = z.enum(["png", "svg"]).default("png").parse(req.query.format);
  const link = await service.ownedLink(
    idSchema.parse(req.params.id),
    res.locals.user.id,
  );
  res.type(format === "svg" ? "image/svg+xml" : "image/png"); // Content-Type บอก Browser ว่าต้องอ่าน Response เป็นภาพ
  if (req.query.download === "1") // LinkResult ปุ่ม PNG/SVG ส่งค่านี้เพื่อรับไฟล์แบบดาวน์โหลด
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${link.code}.${format}"`,
    );
  res.send(await service.generateQr(link, format)); // Buffer PNG/ข้อความ SVG → Gateway → img หรือดาวน์โหลดของ Browser
}
// Browser เปิด /:code หรือ /s/:code (รวมเปิดจาก QR) → redirectDestination ค้น URL/ตรวจสถานะ/ยืนยันบันทึกคลิก
export async function redirect(req: Request, res: Response) {
  const code = String(req.params.code);
  if (!codePattern.test(code) || (req.route.path === "/:code" && isReservedName(code)))
    throw new HttpError(404, "NOT_FOUND", "ไม่พบลิงก์");
  const destination = await service.redirectDestination(
    code,
    req.method === "HEAD",
    req.get("user-agent") || "",
    req.get("referer"),
    String(res.getHeader("X-Request-Id")),
  );
  res.redirect(302, destination); // ตอบ 302 + Location; Browser ส่ง Request ใหม่ไป URL ปลายทางเอง
}
// Analytics statistics ส่ง Body { userId } + path id → ownedLink → { owned: true } กลับ Analytics; ไม่พบโยน 404
export async function ownership(req: Request, res: Response) {
  const input = z
    .object({ userId: z.string().uuid() })
    .strict()
    .parse(req.body);
  await service.ownedLink(idSchema.parse(req.params.id), input.userId);
  res.json({ owned: true });
}
// Analytics statistics ส่ง { userId } → linkSummary → { totalLinks, activeLinks } กลับไปประกอบการ์ดสรุป
export async function summary(req: Request, res: Response) {
  const input = z
    .object({ userId: z.string().uuid() })
    .strict()
    .parse(req.body);
  res.json(await service.linkSummary(input.userId));
}
