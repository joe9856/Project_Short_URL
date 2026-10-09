import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { config } from "./config";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
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
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาตรวจสอบข้อมูล",
        fields: error.flatten().fieldErrors,
      },
    });
    return;
  }
  if (error instanceof HttpError) {
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
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.production ? 10000 : 2500),
    });
  } catch {
    throw new HttpError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "บริการที่เกี่ยวข้องไม่พร้อมใช้งาน",
    );
  }
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
  return response.json();
}
