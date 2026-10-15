import { Router } from "express";
import * as controller from "../controllers/analytics";
import { requireSession } from "../middlewares/session";
// app.ts รับคำขอจาก Gateway/Link Service → Router เลือก controllers/analytics.ts; internalGuard ตรวจ secret ก่อนถึงที่นี่
export const router = Router();
router.post("/internal/visits", controller.visit); // Link.redirectDestination ส่ง event → recordClick → { recorded: true } กลับ Link
router.post("/internal/click-counts", controller.counts); // Link.listLinks ส่ง ownerId/linkIds → { counts } กลับไปแสดง History
router.get("/api/stats", requireSession, controller.stats); // Analytics Component ขอภาพรวม → ตรวจ Cookie → { stats }
router.get("/api/links/:id/stats", requireSession, controller.stats); // LinkDetails ขอผ่าน Analytics Component โดยระบุ id ลิงก์เดียว
