import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
if (existsSync(resolve(root, ".env")))
  throw new Error(
    "Local .env exists; keep existing settings and edit manually.",
  );
function secret() {
  return randomBytes(32).toString("hex");
}
// ตรวจทุกไฟล์ก่อนเขียน เพื่อไม่สร้าง env ครึ่งชุดหากพบไฟล์เดิม
for (const folder of [
  "gateway",
  "services/auth-service",
  "services/link-service",
  "services/analytics-service",
]) {
  if (existsSync(resolve(root, folder, ".env")))
    throw new Error(
      "A service .env already exists; refusing to overwrite settings",
    );
}
const key = secret();
const rootPassword = secret();
const passwords = { auth: secret(), links: secret(), analytics: secret() };
writeFileSync(
  resolve(root, ".env"),
  `APP_URL=http://localhost:5173
INTERNAL_API_SECRET=${key}
MYSQL_ROOT_PASSWORD=${rootPassword}
AUTH_DB_PASSWORD=${passwords.auth}
LINK_DB_PASSWORD=${passwords.links}
ANALYTICS_DB_PASSWORD=${passwords.analytics}
`,
);
const common = `HOST=127.0.0.1
APP_URL=http://localhost:5173
INTERNAL_API_SECRET=${key}
AUTH_SERVICE_URL=http://127.0.0.1:3001
LINK_SERVICE_URL=http://127.0.0.1:3002
ANALYTICS_SERVICE_URL=http://127.0.0.1:3003
`;
writeFileSync(resolve(root, "gateway/.env"), `PORT=3000\n${common}`);
for (const [service, db, port, dbPort] of [
  ["auth-service", "auth", 3001, 3311],
  ["link-service", "links", 3002, 3312],
  ["analytics-service", "analytics", 3003, 3313],
]) {
  if (existsSync(resolve(root, "services", service, ".env")))
    throw new Error("Service .env already exists; refusing to overwrite");
  writeFileSync(
    resolve(root, "services", service, ".env"),
    `PORT=${port}
${common}DATABASE_URL=mysql://${db}_owner:${passwords[db]}@127.0.0.1:${dbPort}/short_${db}
`,
  );
}
console.log(
  "Fresh local settings created. Secrets were not printed. Start the three databases, then run npm run migrate.",
);
