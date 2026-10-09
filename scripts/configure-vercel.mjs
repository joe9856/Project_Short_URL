import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { rootShortLinkSource } from "@short/routing";
const input = process.argv[2];
if (!input) throw new Error("Usage: npm run vercel:gateway -- https://YOUR-GATEWAY.vercel.app");
const url = new URL(input);
if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.hostname.endsWith(".example"))
  throw new Error("Use the real Gateway HTTPS origin, without path or credentials");
const file = resolve(import.meta.dirname, "../frontend/vercel.json");
const config = JSON.parse(readFileSync(file, "utf8"));
// ชื่อสงวนไปหน้าเว็บตามเดิม ลิงก์ทั่วไปไป Gateway ทั้งรูปแบบใหม่และ /s เดิม
config.rewrites = [
  { source: "/api/:path*", destination: url.origin + "/api/:path*" },
  { source: "/s/:path*", destination: url.origin + "/s/:path*" },
  { source: rootShortLinkSource, destination: url.origin + "/:code" },
  { source: "/:path*", destination: "/index.html" },
];
writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
console.log("Frontend API and redirect routes configured for " + url.origin);
