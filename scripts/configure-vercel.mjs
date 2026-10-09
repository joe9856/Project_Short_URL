import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const input = process.argv[2];
if (!input) throw new Error("Usage: npm run vercel:gateway -- https://YOUR-GATEWAY.vercel.app");
const url = new URL(input);
if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.hostname.endsWith(".example"))
  throw new Error("Use the real Gateway HTTPS origin, without path or credentials");
const file = resolve(import.meta.dirname, "../frontend/vercel.json");
const config = JSON.parse(readFileSync(file, "utf8"));
config.rewrites[0].destination = url.origin + "/api/:path*";
config.rewrites[1].destination = url.origin + "/s/:path*";
writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
console.log("Frontend API and redirect routes configured for " + url.origin);
