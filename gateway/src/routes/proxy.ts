import { createProxyMiddleware } from "http-proxy-middleware";
import type { Request, Response } from "express";
export function serviceProxy(
  target: string,
  pathFilter: (path: string) => boolean,
) {
  return createProxyMiddleware<Request, Response>({
    target,
    pathFilter,
    changeOrigin: true,
    xfwd: false,
    proxyTimeout: process.env.NODE_ENV === "production" ? 45000 : 10000,
    timeout: process.env.NODE_ENV === "production" ? 55000 : 12000,
    on: {
      proxyReq(proxyReq, req, res) {
        proxyReq.setHeader(
          "x-internal-key",
          process.env.INTERNAL_API_SECRET || "",
        );
        proxyReq.setHeader(
          "x-client-ip",
          String(res.locals.clientIp || "unknown"),
        );
        proxyReq.setHeader("x-request-id", res.getHeader("X-Request-Id") || "");
      },
      error(_error, _req, res) {
        if ("writeHead" in res && !res.headersSent) {
          res.writeHead(503, {
            "content-type": "application/json",
            "cache-control": "no-store",
          });
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
  });
}
