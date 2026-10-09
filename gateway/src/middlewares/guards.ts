import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
export function guards(req: Request, res: Response, next: NextFunction) {
  // Vercel sets this header at its edge; local/container requests use the socket.
  const edgeIp = process.env.VERCEL === "1" ? req.get("x-vercel-forwarded-for") : undefined;
  res.locals.clientIp = edgeIp && isIP(edgeIp) ? edgeIp : req.socket.remoteAddress || "unknown";
  const id = randomUUID();
  res.locals.requestId = id;
  res.setHeader("X-Request-Id", id);
  res.setHeader("Cache-Control", "no-store");
  // ลบข้อมูล identity/forwarding จากภายนอกก่อน proxy
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
  if (Number(req.get("content-length")) > 32768) {
    res.status(413).json({
      error: { code: "BODY_TOO_LARGE", message: "คำขอมีขนาดใหญ่เกินไป" },
    });
    return;
  }
  next();
}
export async function verifySession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (
    !req.path.startsWith("/api/links") &&
    !req.path.startsWith("/api/stats")
  ) {
    next();
    return;
  }
  try {
    const response = await fetch(
      (process.env.AUTH_SERVICE_URL || "http://localhost:3001") +
        "/internal/sessions/verify",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-key": process.env.INTERNAL_API_SECRET || "",
          cookie: req.headers.cookie || "",
          "x-request-id": res.locals.requestId,
        },
        body: "{}",
        signal: AbortSignal.timeout(process.env.NODE_ENV === "production" ? 10000 : 2500),
      },
    );
    if (response.status === 401) {
      res
        .status(401)
        .json({ error: { code: "UNAUTHORIZED", message: "กรุณาเข้าสู่ระบบ" } });
      return;
    }
    if (!response.ok) throw new Error("Auth unavailable");
    next();
  } catch {
    res.status(503).json({
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "บริการเข้าสู่ระบบไม่พร้อมใช้งาน",
      },
    });
  }
}
