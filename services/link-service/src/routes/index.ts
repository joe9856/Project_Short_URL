import { Router } from "express";
import * as controller from "../controllers/links";
import { requireSession } from "../middlewares/session";
import { databaseRateLimit } from "../middlewares/rateLimit";
// app.ts ส่ง Request เข้ามา; Router เลือก controllers/links.ts จาก Method/path แล้ว Controller จึงเรียก Service
export const router = Router();
router.get("/s/:code", controller.redirect); // เปิด Short URL แบบเดิม → ค้น code/บันทึกคลิก → 302 ให้ Browser ไปปลายทาง
router.post("/internal/links/:id/ownership", controller.ownership); // Analytics ส่ง userId มาตรวจเจ้าของก่อนอ่านสถิติลิงก์เดียว
router.post("/internal/links/summary", controller.summary); // Analytics ส่ง userId มาขอจำนวนลิงก์ทั้งหมด/ที่ยังใช้งาน
router.use("/api/links", requireSession); // กลุ่ม API ลิงก์ทั้งหมด: ตรวจ Cookie กับ Auth → เก็บ res.locals.user → Route ด้านล่าง
// CreateForm ส่ง originalUrl/alias/expiresAt → จำกัดจำนวนการสร้าง → controller.create → 201 { link }
router.post(
  "/api/links",
  databaseRateLimit("create", 100, 3600),
  controller.create,
);
router.get("/api/links", controller.list); // History ส่ง query ค้นหา/หน้า/สถานะ → รายการพร้อม clicks และ pagination
router.get("/api/links/:id/qr", controller.qr); // LinkResult img/ดาวน์โหลดส่ง id/format → ภาพ PNG หรือ SVG กลับ Browser
router.get("/api/links/:id", controller.detail); // LinkDetails ส่ง id → { link } ของเจ้าของคนนี้
router.patch("/api/links/:id", controller.update); // History/LinkDetails ส่งสถานะ/หมดอายุ → { link } หลังแก้ไข
// วางหลัง routes ของระบบ และเก็บ /s/:code เดิมไว้รองรับลิงก์เก่า
router.get("/:code", controller.redirect); // เปิด Short URL แบบปัจจุบัน → ใช้ redirect เช่นเดียวกับ /s/:code
