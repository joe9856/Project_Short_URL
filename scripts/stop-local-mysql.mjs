import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { createConnection } from "mysql2/promise";
const root = resolve(import.meta.dirname, "..");
const settings = parse(readFileSync(resolve(root, ".env")));
for (const port of [3311, 3312, 3313]) {
  const connection = await createConnection({
    host: "127.0.0.1",
    port,
    user: "root",
    password: settings.MYSQL_ROOT_PASSWORD,
  });
  await connection.query("SHUTDOWN");
  await connection.end();
  console.log("Project-local MySQL stopped on " + port);
}
