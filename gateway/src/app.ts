import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { isShortLinkPath } from "@short/routing";
import { guards, verifySession } from "./middlewares/guards";
import { serviceProxy } from "./routes/proxy";
export function createGateway() {
  if (process.env.VERCEL === "1") {
    if ((process.env.INTERNAL_API_SECRET || "").length < 32)
      throw new Error("Set a strong INTERNAL_API_SECRET");
    if (!process.env.APP_URL?.startsWith("https://"))
      throw new Error("Vercel APP_URL must use HTTPS");
  }
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet(), guards);
  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
  // นี่เป็น rate limit ชั้นต้นหนึ่ง replica; Auth/Create ใช้ DB ของ service
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
  app.use(verifySession);
  app.use(
    serviceProxy(
      process.env.AUTH_SERVICE_URL || "http://localhost:3001",
      (path) => path.startsWith("/api/auth/"),
    ),
  );
  app.use(
    serviceProxy(
      process.env.ANALYTICS_SERVICE_URL || "http://localhost:3003",
      (path) =>
        path === "/api/stats" || /^\/api\/links\/[^/]+\/stats$/.test(path),
    ),
  );
  app.use(
    serviceProxy(
      process.env.LINK_SERVICE_URL || "http://localhost:3002",
      (path) =>
        path === "/api/links" ||
        path.startsWith("/api/links/") ||
        path.startsWith("/s/") ||
        isShortLinkPath(path),
    ),
  );
  app.use((_req, res) =>
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "ไม่พบเส้นทาง" } }),
  );
  return app;
}
export const app = createGateway();

export default app;
