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
app.use(helmet(), requestHeaders);
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
app.get("/readyz", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ready" });
});
app.use(internalGuard, express.json({ limit: "32kb" }), originGuard, router);
app.use((_req, res) =>
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "ไม่พบเส้นทาง" } }),
);
app.use(errorHandler);

// Vercel imports this app; server.ts remains the local listener.
export default app;
