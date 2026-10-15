import "dotenv/config"; // โหลดค่าจาก .env ถ้ามี; บน Vercel ใช้ Environment Variables ของ Gateway project
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { isShortLinkPath } from "@short/routing";
import { guards, verifySession } from "./middlewares/guards";
import { serviceProxy } from "./routes/proxy";

// ไฟล์นี้ตั้งกติกาของ Gateway: Request → guards → rate limit → verifySession → เลือก Proxy → Service ปลายทาง
// createGateway() ทำงานตอนเริ่มระบบเพื่อประกอบ app; callback ของ Middleware/Proxy จึงทำงานเมื่อมี Request เข้ามา
// ในเครื่อง server.ts เปิดพอร์ตให้ app นี้; บน Vercel รับ HTTPS ผ่าน app ที่ export default ด้านล่าง
export function createGateway() {
  // บน Vercel ต้องมี secret สำหรับติดต่อ Service และ APP_URL ของ Frontend ที่ใช้ HTTPS
  if (process.env.VERCEL === "1") {
    if ((process.env.INTERNAL_API_SECRET || "").length < 32)
      throw new Error("Set a strong INTERNAL_API_SECRET");
    if (!process.env.APP_URL?.startsWith("https://"))
      throw new Error("Vercel APP_URL must use HTTPS");
  }
  const app = express();
  app.disable("x-powered-by");
  // helmet ตั้ง Header ความปลอดภัย; guards เตรียม IP/requestId ลบ Header ปลอม และตรวจ Origin/ขนาดคำขอ
  app.use(helmet(), guards);
  // ตรวจว่า Gateway ยังตอบ HTTP ได้; เส้นทางนี้ตอบเอง ไม่ส่งไป Auth/Link/Analytics
  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

  /*
  app.ts กำหนดปลายทางและเงื่อนไข
   ↓
  Proxy Middleware รับคำขอที่ตรงเงื่อนไข
    ↓
  แพ็กเกจเรียก Hook proxyReq(...)
    ↓
  โค้ดของคุณเติม Header ทั้งสามตัว
    ↓
  แพ็กเกจส่ง HTTP ไป Service
  พร้อม Method / Path / Body / Cookie
    ↓
  Service ตอบกลับ
    ↓
  แพ็กเกจส่ง Response ผ่าน Gateway กลับผู้เรียก
  */

  // จำกัดคำขอต่อ IP 600 ครั้ง/60 วินาทีใน Gateway instance นี้; เกินกำหนดตอบ 429 และหยุดก่อน Proxy
  // Auth/Create มี rate limit ที่ใช้ฐานข้อมูลของ Service เพิ่มอีกชั้น
  
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 600,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: { code: "RATE_LIMITED", message: "ส่งคำขอบ่อยเกินไป" },
      },
    }),
  );

  // API ลิงก์/สถิติ: guards.ts ส่ง Cookie ไป Auth /internal/sessions/verify ก่อน; ผ่านจึง next() มาถึง Proxy
  app.use(verifySession);
  
  // ทั้ง 3 Proxy ใช้ serviceProxy() จาก routes/proxy.ts ตัวเดียวกัน แต่ส่ง target และ pathFilter ต่างกัน
  // serviceProxy() คืน Middleware ให้ app.use() ติดตั้ง; เมื่อ Request เข้า pathFilter จึงตรวจเส้นทาง
  // path ไม่ตรง → ไป Middleware ถัดไป; ตรง → Proxy ส่ง HTTP ไป target โดยคง Method/path/query/body/Cookie
  // Gateway เลือก Service จาก path; Route ของ Service ปลายทางจึงเลือก Controller จาก Method + path อีกที
  app.use(
    serviceProxy(
      process.env.AUTH_SERVICE_URL || "http://localhost:3001",
      // Login/Register/Me/Logout เช่น POST /api/auth/login → Auth app.ts → routes/index.ts → controller.login
      (path) => path.startsWith("/api/auth/"),
    ),
  );
  app.use(
    serviceProxy(
      // target: URL ของ Analytics; วางก่อน Link เพราะ /api/links/:id/stats ก็ขึ้นต้นด้วย /api/links/
      process.env.ANALYTICS_SERVICE_URL || "http://localhost:3003",
      // /api/stats = ภาพรวม; Regular Expression ตรวจ /api/links/ค่าหนึ่ง/stats = สถิติลิงก์เดียว
      // เส้นทางเหล่านี้ → Analytics app.ts → routes/index.ts → controller.stats → Response สถิติกลับ Proxy
      (path) =>
        path === "/api/stats" || /^\/api\/links\/[^/]+\/stats$/.test(path),
    ),
  );
  app.use(
    serviceProxy(
      // target: URL ของ Link Service จาก Vercel env; 
      process.env.LINK_SERVICE_URL || "http://localhost:3002",
      // API ลิงก์ → Link routes เลือก create/list/detail/update/qr ตาม Method/path
      // Short URL → Link controller.redirect; /:code ต้องผ่านกฎ isShortLinkPath เพื่อไม่ชนชื่อหน้าของเว็บ
      (path) =>
        path === "/api/links" ||
        path.startsWith("/api/links/") ||
        path.startsWith("/s/") ||
        isShortLinkPath(path),
    ),
  );
  // Service ตอบสำเร็จหรือ error → Proxy ส่ง status/body/Header (เช่น Set-Cookie/Location) กลับผู้เรียกอัตโนมัติ
  // หากผ่านมาถึงบรรทัดนี้ แสดงว่าไม่มี Proxy จับ path → Gateway ตอบ 404 เอง ไม่เข้าฐานข้อมูล
  app.use((_req, res) =>
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "ไม่พบเส้นทาง" } }),
  );
  return app; // คืน Express app ที่ตั้งกติกาครบแล้ว; ไม่ใช่ Response ของคำขอสร้างลิงก์
}
// ประกอบ app ตอนโหลดโมดูล เพื่อให้ server.ts หรือ Vercel นำไปใช้รับคำขอ
export const app = createGateway();

export default app;
