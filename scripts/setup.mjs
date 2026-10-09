import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync, readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
const root = resolve(import.meta.dirname, "..");
const folders = ["", "gateway", "services/auth-service", "services/link-service", "services/analytics-service"];
const switching = process.argv.includes("--switch-from-mysql");
if (switching) {
  const settings = parse(readFileSync(resolve(root, "services/auth-service/.env")));
  if (!settings.DATABASE_URL?.startsWith("mysql://"))
    throw new Error("Switch only supports existing MySQL settings; nothing overwritten");
  const backup = resolve(root, ".local/previous-mysql-env");
  for (const folder of folders) {
    const destination = resolve(backup, folder, ".env");
    if (existsSync(destination)) throw new Error("MySQL settings backup already exists; nothing overwritten");
  }
  for (const folder of folders) {
    mkdirSync(resolve(backup, folder), { recursive: true });
    copyFileSync(resolve(root, folder, ".env"), resolve(backup, folder, ".env"));
  }
} else if (folders.some(folder => existsSync(resolve(root, folder, ".env")))) {
  throw new Error("Existing .env found; refusing to overwrite. For the MySQL transition use --switch-from-mysql.");
}
const secret = () => randomBytes(32).toString("hex");
const key = secret();
const passwords = { auth: secret(), links: secret(), analytics: secret() };
writeFileSync(resolve(root, ".env"), `APP_URL=http://localhost:5173
INTERNAL_API_SECRET=${key}
POSTGRES_ADMIN_PASSWORD=${secret()}
POSTGRES_PORT=5544
AUTH_DB_PASSWORD=${passwords.auth}
LINK_DB_PASSWORD=${passwords.links}
ANALYTICS_DB_PASSWORD=${passwords.analytics}
`);
const common = `HOST=127.0.0.1
APP_URL=http://localhost:5173
INTERNAL_API_SECRET=${key}
AUTH_SERVICE_URL=http://127.0.0.1:3001
LINK_SERVICE_URL=http://127.0.0.1:3002
ANALYTICS_SERVICE_URL=http://127.0.0.1:3003
`;
writeFileSync(resolve(root, "gateway/.env"), `PORT=3000\n${common}`);
for (const [service, name, port] of [["auth-service", "auth", 3001], ["link-service", "links", 3002], ["analytics-service", "analytics", 3003]]) {
  const url = `postgresql://${name}_owner:${passwords[name]}@127.0.0.1:5544/short_url?schema=app_${name}`;
  writeFileSync(resolve(root, "services", service, ".env"), `PORT=${port}\n${common}DATABASE_URL=${url}\nDIRECT_URL=${url}\n`);
}
console.log("PostgreSQL settings created. Secrets were not printed. Start the database, then npm run migrate.");
if (switching) console.log("Original MySQL settings preserved in .local/previous-mysql-env; original database files unchanged.");
