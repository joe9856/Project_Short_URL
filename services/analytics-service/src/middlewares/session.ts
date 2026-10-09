import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { config } from "../lib/config";
import { internalPost } from "../lib/http";
const identitySchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
});
export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // ให้ Auth ตรวจ cookie อีกครั้ง ก่อนใช้ userId ใน query ของบริการนี้
  const result = await internalPost(
    config.authUrl + "/internal/sessions/verify",
    {},
    req.headers.cookie,
    String(res.getHeader("X-Request-Id")),
  );
  res.locals.user = identitySchema.parse(result).user;
  next();
}
