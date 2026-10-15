import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
// app.ts ติดตั้งก่อน Proxy: req คือคำขอเข้า, res ใช้ตอบผู้เรียก, next() ให้ Express ไป Middleware ถัดไป
// เตรียม IP/requestId และตรวจคำขอ; res.locals เก็บข้อมูลเฉพาะคำขอนี้ให้ verifySession/proxy ใช้ ไม่ใช่ JSON ที่ตอบ Frontend
export function guards(req: Request, res: Response, next: NextFunction) {
  // บน Vercel อ่าน IP จาก Header ที่ edge ตั้งและตรวจด้วย isIP; ในเครื่อง/Container ใช้ IP จาก socket
  const edgeIp = process.env.VERCEL === "1" ? req.get("x-vercel-forwarded-for") : undefined;
  res.locals.clientIp = edgeIp && isIP(edgeIp) ? edgeIp : req.socket.remoteAddress || "unknown";
  const id = randomUUID(); // สร้างรหัสใหม่ต่อคำขอเพื่อเชื่อมการติดตาม Gateway → Auth/Link/Analytics
  res.locals.requestId = id; // verifySession ใช้ค่าใน locals เป็น Header ของคำขอตรวจ Session
  // Proxy อ่าน Header นี้แล้วส่งให้ Service; ผู้เรียกก็ได้รับรหัสเดียวกันใน Response
  res.setHeader("X-Request-Id", id);
  res.setHeader("Cache-Control", "no-store");
  // ลบ Header ที่ผู้เรียกอาจปลอมมา เช่น secret/userId/IP; Proxy จะเติม secret/IP/requestId ของ Gateway เอง
  // ไม่ลบ Cookie เพราะ Auth ต้องใช้ตรวจ Session และไม่ลบ Origin เพราะปลายทางใช้ตรวจที่มาของคำขอ
  for (const header of [
    "x-user-id",
    "x-internal-key",
    "x-client-ip",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-vercel-forwarded-for",
    "forwarded",
    "x-request-id",
  ])
    delete req.headers[header];
  // POST/PATCH/PUT/DELETE ต้องมี Origin ตรงกับ APP_URL ของ Frontend; ไม่ผ่านตอบ 403 แล้ว return หยุดก่อน Proxy
  if (
    ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) &&
    req.get("origin") !==
      new URL(process.env.APP_URL || "http://localhost:5173").origin
  ) {
    res.status(403).json({
      error: {
        code: "INVALID_ORIGIN",
        message: "แหล่งที่มาของคำขอไม่ถูกต้อง",
      },
    });
    return;
  }
  // ตรวจขนาดที่แจ้งใน Content-Length; เกิน 32 KB ตอบ 413 ก่อนส่งต่อ (Service ยังจำกัด JSON Body อีกชั้น)
  if (Number(req.get("content-length")) > 32768) {
    res.status(413).json({
      error: { code: "BODY_TOO_LARGE", message: "คำขอมีขนาดใหญ่เกินไป" },
    });
    return;
  }
  next(); // ตรวจผ่าน → rate limit ใน app.ts → verifySession ด้านล่าง → Proxy เลือก Service
}
// app.ts เรียกหลัง guards/rate limit: API ลิงก์และสถิติต้องผ่าน Auth ก่อนจึงส่งคำขอหลักไป Link/Analytics
// นี่คือการสร้าง HTTP Request แยกเพื่อตรวจ Session; ไม่ใช่การส่ง Body สร้างลิงก์ไปให้ Auth บันทึก
export async function verifySession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (
    !req.path.startsWith("/api/links") &&
    !req.path.startsWith("/api/stats")
  ) {
    next(); // path อื่น เช่น Login/เปิด Short URL ข้ามการตรวจนี้ แล้วให้ Proxy เลือก Service ตาม path
    return;
  }
  try {
    // รอ Auth ตรวจ Cookie ผ่าน controller.me → getUserFromSession ใน services/auth-service/src/services/auth.ts
    const response = await fetch(
      // ใช้ URL ของ Auth project บน Vercel หรือค่าเริ่มต้น 3001 ในเครื่อง แล้วต่อเส้นทางตรวจ Session ภายใน
      (process.env.AUTH_SERVICE_URL || "http://localhost:3001") +
        "/internal/sessions/verify",
      {
        method: "POST", // คำขอตรวจ Session ใช้ POST แม้คำขอหลักจาก Frontend จะเป็น GET /api/stats
        headers: {
          "content-type": "application/json",
          // Auth internalGuard ตรวจ secret ก่อนให้ Route /internal/sessions/verify ทำงาน
          "x-internal-key": process.env.INTERNAL_API_SECRET || "",
          // ใช้ Cookie เดิมจากเบราว์เซอร์ ให้ Auth หา Session/ผู้ใช้จากฐานข้อมูล ไม่รับ userId ที่ผู้ใช้ส่งเอง
          cookie: req.headers.cookie || "",
          // ใช้รหัสเดียวกับคำขอหลักเพื่อเชื่อมการติดตาม ไม่สร้าง requestId ใหม่สำหรับการตรวจนี้
          "x-request-id": res.locals.requestId,
        },
        body: "{}", // JSON ว่าง: ข้อมูลยืนยันตัวตนอยู่ใน Cookie ไม่ต้องส่ง originalUrl ไป Auth
        // ให้การตรวจ Session รอได้ 10 วินาทีบน Production หรือ 2.5 วินาทีในเครื่อง; timeout จะไป catch
        signal: AbortSignal.timeout(process.env.NODE_ENV === "production" ? 10000 : 2500),
      },
    );
    // Auth บอกว่าไม่มี Session ที่ใช้ได้ → Gateway ตอบ 401 ให้ Frontend แล้วหยุด ไม่เรียก next()/Proxy
    if (response.status === 401) {
      res
        .status(401)
        .json({ error: { code: "UNAUTHORIZED", message: "กรุณาเข้าสู่ระบบ" } });
      return;
    }
    // สถานะอื่นที่ไม่ใช่ 2xx ถือว่าตรวจไม่ได้ → throw เข้า catch แล้ว Gateway ตอบ 503
    if (!response.ok) throw new Error("Auth unavailable");
    // Auth ยืนยันแล้ว → next() เข้า Proxy ใน app.ts และส่งคำขอหลักพร้อม Body/Cookie เดิมต่อไป
    // Gateway ไม่อ่าน JSON { user } มาเก็บ; Middleware ของ Link/Analytics ตรวจ Cookie กับ Auth อีกครั้งเพื่อได้ user
    next();
  } catch {
    // ติดต่อ Auth ไม่ได้/timeout/สถานะไม่สำเร็จ → ตอบ 503 เอง หยุดก่อนส่งคำขอหลักไป Link/Analytics
    res.status(503).json({
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "บริการเข้าสู่ระบบไม่พร้อมใช้งาน",
      },
    });
  }
}
