// server.ts (เครื่อง/Container) หรือ Vercel เรียก app นี้; รับ Request → Middleware → routes/index.ts → Controller
import express from "express";
import helmet from "helmet";
import { router } from "./routes";
import { prisma } from "./lib/prisma";
import {
  internalGuard,
  originGuard,
  requestHeaders,
  errorHandler,
} from "./lib/http";
import { validateConfig } from "./lib/config";

if (process.env.VERCEL) validateConfig();

export const app = express();
app.disable("x-powered-by");
app.use(helmet(), requestHeaders); // ตั้ง Header และ requestId ให้ใช้ต่อใน Controller/คำขอข้าม Service
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
app.get("/readyz", async (_req, res) => { // เครื่องมือตรวจความพร้อมเรียก → SELECT 1 ทดสอบ DB → ตอบ ready
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ready" });
});

// ตรวจ secret จาก Gateway/Service → อ่าน JSON เป็น req.body → ตรวจ origin → ให้ router เลือก Handler
app.use(
  internalGuard,  //ตรวจ x-internal-key ที่ Gateway ส่งมา  เปรียบเทียบกับรหัสลับของ Service
  express.json({ limit: "32kb" }), //อ่าน JSON ใน Body ให้เข้าถึงผ่าน req.body
  originGuard, router);//จับคู่ HTTP Method และ Path เพื่อเลือกฟังก์ชัน

// ไม่ตรง Route ใด → JSON 404 ย้อนกลับให้ผู้เรียก; ถ้ามี throw/reject จะไป errorHandler ด้านล่าง
app.use((_req, res) =>
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "ไม่พบเส้นทาง" } }),
);
app.use(errorHandler); // lib/http.ts แปลงข้อผิดพลาดจาก Middleware/Controller/Service/DB เป็น HTTP Response

// Vercel imports this app; server.ts remains the local listener.
export default app;
