import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { config } from "./config";

// Middleware/Service โยน status/code/message → errorHandler อ่านแล้วตอบ JSON → api.ts หรือ internalPost รับข้อผิดพลาด
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
// app.ts เรียกก่อน Router: รับ x-internal-key จาก Gateway/Service และเทียบกับ config.secret; ผ่านจึง next()
export function internalGuard(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  // รับคำขอจาก Gateway/บริการที่รู้ secret เท่านั้น ไม่เชื่อ header จากผู้ใช้
  const expected = Buffer.from(config.secret);
  const received = Buffer.from(req.get("x-internal-key") || "");
  if (
    !expected.length ||
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw new HttpError(
      403,
      "INTERNAL_ACCESS_DENIED",
      "ไม่อนุญาตให้เข้าถึงบริการโดยตรง",
    );
  }
  next();
}
// รับ Method/path/origin ของ Request; API ที่แก้ข้อมูลต้องมาจากหน้าเว็บที่ตั้งไว้ ไม่ผ่านโยน 403
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (
    ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) &&
    req.path.startsWith("/api/") &&
    req.get("origin") !== config.appUrl
  ) {
    throw new HttpError(403, "INVALID_ORIGIN", "แหล่งที่มาของคำขอไม่ถูกต้อง");
  }
  next();
}
// app.ts เรียกทุก Request: ส่ง X-Request-Id ให้ Controller ใช้ติดตามและส่งต่อ HTTP ไป Service อื่น
export function requestHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("Cache-Control", "no-store");
  const incoming = req.get("x-request-id");
  const requestId =
    incoming && /^[a-zA-Z0-9-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", requestId);
  next();
}
// Express ส่งข้อผิดพลาดจากขั้นก่อนหน้ามาที่นี่ → JSON รูปแบบ { error: { code, message, fields? } } กลับผู้เรียก
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) { // schema.parse ไม่ผ่าน → 400 พร้อมข้อความรายช่องให้ frontend/api.ts รวมข้อความ
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาตรวจสอบข้อมูล",
        fields: error.flatten().fieldErrors,
      },
    });
    return;
  }
  if (error instanceof HttpError) { // ข้อผิดพลาดที่ระบบกำหนดไว้ → ใช้ status/code/message เดิม
    res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (
    error &&
    typeof error === "object" &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    res.status(413).json({
      error: { code: "BODY_TOO_LARGE", message: "คำขอมีขนาดใหญ่เกินไป" },
    });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({
      error: { code: "INVALID_JSON", message: "รูปแบบ JSON ไม่ถูกต้อง" },
    });
    return;
  }
  // ไม่ส่ง SQL, stack หรือ secret กลับไปยัง browser
  console.error(
    JSON.stringify({
      event: "request_failed",
      requestId: res.getHeader("X-Request-Id"),
      type: error instanceof Error ? error.name : "Unknown",
    }),
  );
  res.status(503).json({
    error: {
      code: "SERVICE_UNAVAILABLE",
      message: "บริการไม่พร้อมใช้งาน กรุณาลองอีกครั้ง",
    },
  });
}
// ตัวช่วยฝั่ง Backend: ผู้เรียกส่ง url/body/Cookie/requestId → POST ไป Service อื่น → คืน JSON ให้ await ของผู้เรียก
// requireSession → Auth sessions/verify; services/analytics.ts statistics → Link ownership/summary
export async function internalPost(
  url: string,
  body: object,
  cookie?: string,
  requestId?: string,
): Promise<unknown> {
  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key": config.secret,
        ...(cookie ? { cookie } : {}),
        ...(requestId ? { "x-request-id": requestId } : {}),
      },
      body: JSON.stringify(body), // object จาก Service ผู้เรียก → JSON ที่ Controller ปลายทางอ่านผ่าน req.body
      signal: AbortSignal.timeout(config.production ? 10000 : 2500),
    });
  } catch {
    throw new HttpError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "บริการที่เกี่ยวข้องไม่พร้อมใช้งาน",
    );
  }
  // Response จากปลายทางไม่สำเร็จ → โยน HttpError ให้ผู้เรียกหยุดงาน หรือจัดการ Retry ก่อนเข้า errorHandler
  if (response.status === 401)
    throw new HttpError(401, "UNAUTHORIZED", "กรุณาเข้าสู่ระบบ");
  if (response.status === 404)
    throw new HttpError(404, "NOT_FOUND", "ไม่พบข้อมูล");
  if (!response.ok)
    throw new HttpError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "บริการที่เกี่ยวข้องไม่พร้อมใช้งาน",
    );
  return response.json(); // JSON ปลายทาง → Service ผู้เรียก; ผู้เรียกใช้ Zod ตรวจรูปแบบที่คาดไว้ต่อ
}
