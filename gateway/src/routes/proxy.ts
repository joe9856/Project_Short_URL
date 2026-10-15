import { createProxyMiddleware } from "http-proxy-middleware"; // แพ็กเกจที่ติดต่อ Service ผ่าน HTTP และส่ง Response ย้อนกลับ
import type { Request, Response } from "express";
// app.ts เรียกฟังก์ชันนี้ตอนตั้งระบบ: target = URL ปลายทาง, pathFilter = ฟังก์ชันตรวจว่า Request นี้ควรส่งไปหรือไม่
// คืน Middleware ให้ app.use(); การส่ง HTTP เกิดภายหลังเมื่อมี Request ที่ตรงเงื่อนไขเข้ามา
// Proxy ส่ง Method/path/query/body/Cookie ต่อให้ Service; Gateway จึงไม่ได้เรียก Controller ของ Service โดยตรง
// app.ts ของ Gateway ไม่ใช้ express.json() อ่าน Body ก่อน Proxy เพื่อให้ส่งข้อมูล Body เดิมต่อไปได้
export function serviceProxy(
  target: string,
  pathFilter: (path: string) => boolean,
) {
  // Request/Response เป็น TypeScript types ของ Express; ตัวส่ง HTTP จริงคือ Middleware ที่แพ็กเกจสร้าง
  return createProxyMiddleware<Request, Response>({
    target, // URL ฐานของ Service; path เดิม เช่น /api/links จะถูกส่งต่อไปที่ปลายทางนี้
    pathFilter, // true = ส่งไป target; false = ให้ Express ทำ Middleware ถัดไปใน gateway/app.ts
    changeOrigin: true, // เปลี่ยน Host header ให้ตรงปลายทาง; Origin ของ Frontend ยังใช้ตรวจที่ Service
    xfwd: false, // ไม่ให้ Proxy เพิ่ม X-Forwarded-*; ใช้ x-client-ip ที่ guards.ts เตรียมเอง

    // Timeout ฝั่งคำขอที่ส่งออกและฝั่งคำขอเข้า; Production ใช้ 45/55 วินาที ในเครื่องใช้ 10/12 วินาที
    proxyTimeout: process.env.NODE_ENV === "production" ? 45000 : 10000,
    timeout: process.env.NODE_ENV === "production" ? 55000 : 12000,
    on: {
      // Hook นี้ทำงานก่อนส่งคำขอออก: proxyReq = คำขอไป Service, req = คำขอเข้า, res = Response กลับผู้เรียก
      proxyReq(proxyReq, req, res) {
        // เตรียมรหัสลับให้ Service ตรวจ เตรียม secret จากฝั่ง Gateway ให้ internalGuard ใน Service ตรวจ ก่อนอ่าน Body/เลือก Route
        proxyReq.setHeader(
          "x-internal-key", //ชื่อ Header ที่ Service จะอ่าน
          process.env.INTERNAL_API_SECRET || "",
        );
        // เตรียม IP ของผู้ใช้ ส่ง IP ที่ guards.ts ตรวจแล้ว ให้ Middleware rate limit ของ Service ใช้กับคำขอนี้
        proxyReq.setHeader(
          "x-client-ip", //ชื่อ Header สำหรับส่ง IP ของผู้ใช้
          String(res.locals.clientIp || "unknown"),
        );
        // เตรียมรหัสติดตามคำขอ ส่งรหัสคำขอเดียวกันข้าม Service เพื่อใช้ติดตามการทำงาน; guards.ts เป็นคนสร้างรหัสนี้
        proxyReq.setHeader("x-request-id", 
          res.getHeader("X-Request-Id") || "");
        // Cookie/Body/Method/path เดิมส่งต่อโดยแพ็กเกจ ไม่ต้องคัดลอกทีละค่าใน Hook นี้
      },
      // Hook นี้รับปัญหาการติดต่อปลายทาง เช่น Service ปิด/timeout; HTTP 400/401/409 จาก Service จะส่งกลับตามเดิม
      error(_error, _req, res) {
        // ตอบเองได้เมื่อ res มี writeHead และยังไม่เริ่มส่ง Header เพื่อไม่ตอบซ้ำ
        if ("writeHead" in res && !res.headersSent) {
          // 503 = ติดต่อ Service ไม่ได้; คำขอ API จะไปเข้าการตรวจ response.ok ใน frontend/src/services/api.ts
          res.writeHead(503, {
            "content-type": "application/json",
            "cache-control": "no-store",
          });
          // จบ Response ด้วย JSON error; Frontend จับข้อผิดพลาดแล้วแสดงข้อความ ไม่ได้รับผลลิงก์สำเร็จ
          res.end(
            JSON.stringify({
              error: {
                code: "UPSTREAM_UNAVAILABLE",
                message: "บริการไม่พร้อมใช้งาน กรุณาลองอีกครั้ง",
              },
            }),
          );
        }
      },
    },
  }); // เมื่อ Service ตอบกลับ แพ็กเกจส่ง status/body/Header รวม Set-Cookie และ Location กลับผ่าน Gateway อัตโนมัติ
}
