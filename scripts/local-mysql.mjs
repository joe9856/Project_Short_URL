import { spawn } from "node:child_process";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  createWriteStream,
} from "node:fs";
import { resolve } from "node:path";
import { createConnection } from "mysql2/promise";
import { parse } from "dotenv";

const root = resolve(import.meta.dirname, "..");
const settings = parse(readFileSync(resolve(root, ".env")));
const basedir = resolve(root, ".local/mysql-8.4.11-winx64");
const executable = resolve(basedir, "bin/mysqld.exe");
if (!existsSync(executable))
  throw new Error(
    "Extract official MySQL 8.4.11 Windows ZIP into .local first. See docs/local-mysql.md.",
  );
const specs = [
  ["auth", 3311, settings.AUTH_DB_PASSWORD],
  ["links", 3312, settings.LINK_DB_PASSWORD],
  ["analytics", 3313, settings.ANALYTICS_DB_PASSWORD],
];
const processes = [];
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function initialize(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error("MySQL initialization failed; inspect .local/*.log"),
          ),
    );
  });
}
async function shutdown() {
  for (const [db, port] of specs) {
    try {
      const connection = await createConnection({
        host: "127.0.0.1",
        port,
        user: "root",
        password: settings.MYSQL_ROOT_PASSWORD,
      });
      await connection.query("SHUTDOWN");
      await connection.end();
    } catch {}
  }
  for (const child of processes) if (child.exitCode === null) child.kill();
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
try {
  for (const [db, port, password] of specs) {
    const datadir = resolve(root, ".local/db-" + db);
    mkdirSync(datadir, { recursive: true });
    const fresh = !existsSync(resolve(datadir, "mysql"));
    const common = [
      "--no-defaults",
      "--basedir=" + basedir,
      "--datadir=" + datadir,
      "--log-error=" + resolve(root, ".local/" + db + "-mysql.log"),
    ];
    if (fresh) await initialize([...common, "--initialize-insecure"]);
    const child = spawn(
      executable,
      [
        ...common,
        "--bind-address=127.0.0.1",
        "--port=" + port,
        "--mysqlx=0",
          "--default-time-zone=+00:00",
        "--innodb-buffer-pool-size=64M",
        "--max-connections=100",
        "--skip-log-bin",
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    const log = createWriteStream(
      resolve(root, ".local/" + db + "-process.log"),
      { flags: "a" },
    );
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    processes.push(child);
    let connection;
    for (let attempt = 0; attempt < 150; attempt++) {
      try {
        connection = await createConnection({
          host: "127.0.0.1",
          port,
          user: "root",
          password: fresh ? "" : settings.MYSQL_ROOT_PASSWORD,
          connectTimeout: 1000,
        });
        break;
      } catch {
        await delay(200);
      }
    }
    if (!connection)
      throw new Error(
        "MySQL failed to start on " +
          port +
          "; inspect .local/" +
          db +
          "-mysql.log",
      );
    if (fresh) {
      // ใช้ DB ใหม่และบัญชีเจ้าของแต่ละบริการเท่านั้น ไม่แตะ DB เดิม
      await connection.query(
        "CREATE DATABASE short_" +
          db +
          " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      );
      await connection.query(
        "CREATE DATABASE short_" +
          db +
          "_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      );
      await connection.query(
        "CREATE USER '" + db + "_owner'@'%' IDENTIFIED BY ?",
        [password],
      );
      await connection.query(
        "GRANT ALL PRIVILEGES ON short_" + db + ".* TO '" + db + "_owner'@'%'",
      );
      await connection.query(
        "GRANT ALL PRIVILEGES ON short_" +
          db +
          "_test.* TO '" +
          db +
          "_owner'@'%'",
      );
      await connection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [
        settings.MYSQL_ROOT_PASSWORD,
      ]);
    }
    await connection.end();
    console.log("Isolated MySQL " + db + " ready on 127.0.0.1:" + port);
  }
  writeFileSync(
    resolve(root, ".local/mysql-pids.json"),
    JSON.stringify(processes.map((child) => child.pid)),
  );
  console.log(
    "All three real MySQL databases are ready. Keep this terminal running.",
  );
} catch (error) {
  console.error(error.message);
  await shutdown();
  process.exitCode = 1;
}
