import { spawn } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { parse } from "dotenv";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const settings = parse(readFileSync(resolve(root, ".env")));
const secret = settings.INTERNAL_API_SECRET;
const origin = "http://localhost:5173";
const base = "http://127.0.0.1:3100";
const processes = {};
const clients = {};
const logs = [];
const results = [];
const specs = [
  ["auth", "auth-service", 3101, Number(settings.POSTGRES_PORT || 5544), "auth_owner", settings.AUTH_DB_PASSWORD],
  [
    "links",
    "link-service",
    3102,
    Number(settings.POSTGRES_PORT || 5544),
    "links_owner",
    settings.LINK_DB_PASSWORD,
  ],
  [
    "analytics",
    "analytics-service",
    3103,
    Number(settings.POSTGRES_PORT || 5544),
    "analytics_owner",
    settings.ANALYTICS_DB_PASSWORD,
  ],
];
const common = {
  ...process.env,
  NODE_ENV: "test",
  APP_URL: origin,
  INTERNAL_API_SECRET: secret,
  HOST: "127.0.0.1",
  AUTH_SERVICE_URL: "http://127.0.0.1:3101",
  LINK_SERVICE_URL: "http://127.0.0.1:3102",
  ANALYTICS_SERVICE_URL: "http://127.0.0.1:3103",
};
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function run(command, args, env, cwd = root) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Command failed: " + output)),
    );
  });
}
async function wait(port) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/readyz", {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error("Service not ready: " + port + "\n" + logs.join("\n"));
}
async function start(name, folder, port, url) {
  const child = spawn(process.execPath, ["dist/server.js"], {
    cwd: resolve(root, folder),
    env: {
      ...common,
      PORT: String(port),
      ...(url ? { DATABASE_URL: url, DIRECT_URL: url } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => logs.push(name + ": " + chunk));
  child.stderr.on("data", (chunk) => logs.push(name + ": " + chunk));
  processes[name] = child;
  if (name === "gateway") {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/healthz")).ok) return;
      } catch {}
      await delay(100);
    }
    throw new Error("Gateway not ready");
  }
  await wait(port);
}
async function stop(name) {
  const child = processes[name];
  if (!child || child.exitCode !== null) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill();
  });
  delete processes[name];
}
async function check(name, work) {
  await work();
  results.push({ name, status: "passed" });
  console.log("PASS " + name);
}
async function request(
  path,
  {
    method = "GET",
    body,
    cookie,
    internal = false,
    port = 3100,
    headers = {},
  } = {},
) {
  return fetch("http://127.0.0.1:" + port + path, {
    method,
    redirect: "manual",
    headers: {
      Origin: origin,
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...(internal ? { "x-internal-key": secret } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
}
async function register(email) {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: { name: "ผู้ทดสอบ", email, password: "password123" },
  });
  assert.equal(response.status, 201);
  return (await response.json()).user;
}
async function login(email) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: "password123" },
  });
  assert.equal(response.status, 200);
  const header = response.headers.get("set-cookie");
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  return header.split(";")[0];
}
async function create(cookie, input = {}) {
  const response = await request("/api/links", {
    method: "POST",
    cookie,
    body: { originalUrl: "https://example.com/path?x=1#fragment", ...input },
  });
  assert.equal(response.status, 201);
  return (await response.json()).link;
}
let owner, cookie, link, secondCookie;
const urls = {};
try {
  for (const [name, service, port, dbPort, user, password] of specs) {
    const database = "short_url_test";
    assert.ok(database.endsWith("_test"));
    const url = `postgresql://${user}:${password}@127.0.0.1:${dbPort}/${database}?schema=app_${name}&connection_limit=5`;
    urls[name] = url;
    await run(
      process.execPath,
      [
        resolve(root, "node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
      ],
      { ...common, DATABASE_URL: url, DIRECT_URL: url },
      resolve(root, "services", service),
    );
    const { PrismaClient } = require(
      resolve(root, "services", service, "generated/client"),
    );
    const client = new PrismaClient({ datasources: { db: { url } } });
    clients[name] = client;
    // ล้างข้อมูลเฉพาะ DB ทดสอบที่ลงท้าย _test เท่านั้น
    if (name === "auth") {
      await client.session.deleteMany();
      await client.user.deleteMany();
      await client.rateLimit.deleteMany();
    }
    if (name === "links") {
      await client.link.deleteMany();
      await client.rateLimit.deleteMany();
    }
    if (name === "analytics") await client.clickEvent.deleteMany();
    await start(name, "services/" + service, port, url);
  }
  await start("gateway", "gateway", 3100);
  await check("Independent health and database ownership", async () => {
    for (const [name, , port] of specs) {
      assert.equal(
        (await fetch("http://127.0.0.1:" + port + "/healthz")).status,
        200,
      );
      await assert.rejects(() =>
        clients[name].$queryRawUnsafe(name === "auth" ? "SELECT * FROM app_links.links" : "SELECT * FROM app_auth.users"),
      );
    }
  });
  await check("Register, login, verify and opaque session cookie", async () => {
    owner = await register("owner@integration.test");
    cookie = await login(owner.email);
    assert.equal((await request("/api/auth/me", { cookie })).status, 200);
    assert.equal((await request("/api/auth/me")).status, 401);
    assert.equal(
      (await request("/api/links", { cookie: "short_session=invalid" })).status,
      401,
    );
    const user = await clients.auth.user.findUnique({
      where: { id: owner.id },
    });
    assert.match(user.passwordHash, /^\$argon2id\$/);
    const session = await clients.auth.session.findFirst();
    assert.notEqual(session.tokenHash, cookie.split("=")[1]);
  });
  await check("Create, duplicate aliases and validation", async () => {
    link = await create(cookie, { alias: "campaign" });
    assert.equal(
      (
        await request("/api/links", {
          method: "POST",
          cookie,
          body: { originalUrl: "https://example.com", alias: "campaign" },
        })
      ).status,
      409,
    );
    for (const originalUrl of [
      "javascript:alert(1)",
      "https://name:pass@example.com",
    ])
      assert.equal(
        (
          await request("/api/links", {
            method: "POST",
            cookie,
            body: { originalUrl },
          })
        ).status,
        400,
      );
  });
  await check(
    "20 concurrent creates with database UNIQUE enforcement",
    async () => {
      const links = await Promise.all(
        Array.from({ length: 20 }, () => create(cookie)),
      );
      assert.equal(new Set(links.map((link) => link.code)).size, 20);
      const race = await Promise.all(
        Array.from({ length: 20 }, () =>
          request("/api/links", {
            method: "POST",
            cookie,
            body: { originalUrl: "https://example.com", alias: "same-race" },
          }),
        ),
      );
      assert.equal(
        race.filter((response) => response.status === 201).length,
        1,
      );
      assert.equal(
        race.filter((response) => response.status === 409).length,
        19,
      );
    },
  );
  await check("QR PNG/SVG and HEAD never create click events", async () => {
    for (const format of ["png", "svg"]) {
      const response = await request(
        "/api/links/" + link.id + "/qr?format=" + format + "&download=1",
        { cookie },
      );
      assert.equal(response.status, 200);
      assert.ok(
        response.headers
          .get("content-disposition")
          .includes("campaign." + format),
      );
      const bytes = Buffer.from(await response.arrayBuffer());
      if (format === "png")
        assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      else assert.match(bytes.toString(), /<svg/);
    }
    const response = await request("/s/" + link.code, { method: "HEAD" });
    assert.equal(response.status, 302);
    assert.equal(await clients.analytics.clickEvent.count(), 0);
  });
  await check(
    "20 concurrent redirects persist exactly 20 separate events",
    async () => {
      const responses = await Promise.all(
        Array.from({ length: 20 }, () =>
          request("/s/" + link.code, {
            headers: {
              "user-agent": "Mobile iPhone",
              referer: "https://news.example.com/article",
            },
          }),
        ),
      );
      for (const response of responses) {
        assert.equal(response.status, 302);
        assert.equal(response.headers.get("location"), link.originalUrl);
        assert.equal(response.headers.get("cache-control"), "no-store");
      }
      assert.equal(
        await clients.analytics.clickEvent.count({
          where: { linkId: link.id },
        }),
        20,
      );
    },
  );
  await check(
    "Replay after lost acknowledgment is idempotent; changed replay conflicts",
    async () => {
      const event = {
        eventId: randomUUID(),
        ownerId: owner.id,
        linkId: link.id,
        clickedAt: new Date().toISOString(),
        deviceType: "desktop",
        referrerHost: "direct",
      };
      const responses = await Promise.all(
        Array.from({ length: 20 }, () =>
          request("/internal/visits", {
            method: "POST",
            internal: true,
            port: 3103,
            body: event,
          }),
        ),
      );
      for (const response of responses) assert.equal(response.status, 201);
      assert.equal(
        await clients.analytics.clickEvent.count({
          where: { eventId: event.eventId },
        }),
        1,
      );
      assert.equal(
        (
          await request("/internal/visits", {
            method: "POST",
            internal: true,
            port: 3103,
            body: { ...event, referrerHost: "changed" },
          })
        ).status,
        409,
      );
    },
  );
  await check(
    "History batch counts, pagination, filters and Bangkok statistics",
    async () => {
      const response = await request("/api/links?search=campaign&pageSize=1", {
        cookie,
      });
      const data = await response.json();
      assert.equal(data.links.length, 1);
      assert.equal(data.links[0].clicks, 21);
      const stats = (
        await (
          await request("/api/links/" + link.id + "/stats", { cookie })
        ).json()
      ).stats;
      assert.equal(stats.totalClicks, 21);
      assert.equal(
        stats.clicksByDate.reduce((sum, day) => sum + day.clicks, 0),
        21,
      );
      assert.equal(
        stats.devices.find((device) => device.name === "mobile").clicks,
        20,
      );
      assert.equal(stats.range.timezone, "Asia/Bangkok");
      assert.equal(
        (await request("/api/stats?from=2026-02-30", { cookie })).status,
        400,
      );
    },
  );
  await check("PostgreSQL case-sensitive aliases, insensitive URL search and Bangkok midnight", async () => {
    const first = await create(cookie, { alias: "CaseAlias", originalUrl: "https://example.com/CamelCampaign" });
    const second = await create(cookie, { alias: "casealias" });
    assert.notEqual(first.id, second.id);
    const found = await (await request("/api/links?search=camelcampaign", { cookie })).json();
    assert.equal(found.links.length, 1);
    assert.equal(found.links[0].id, first.id);
    for (const clickedAt of ["2026-10-08T16:59:59.999Z", "2026-10-08T17:00:00.000Z"]) {
      const response = await request("/internal/visits", { method: "POST", internal: true, port: 3103,
        body: { eventId: randomUUID(), ownerId: owner.id, linkId: first.id, clickedAt, deviceType: "desktop", referrerHost: "direct" } });
      assert.equal(response.status, 201);
    }
    const stats = (await (await request("/api/links/" + first.id + "/stats?from=2026-10-08&to=2026-10-09", { cookie })).json()).stats;
    assert.equal(stats.totalClicks, 2);
    assert.deepEqual(stats.clicksByDate, [{ date: "2026-10-08", clicks: 1 }, { date: "2026-10-09", clicks: 1 }]);
    assert.equal((await request("/api/auth/me", { method: "PATCH", cookie, body: { name: "ชื่อใหม่ PostgreSQL" } })).status, 200);
    assert.equal((await (await request("/api/auth/me", { cookie })).json()).user.name, "ชื่อใหม่ PostgreSQL");
  });
  await check(
    "Unauthorized, invalid Origin, spoofed identity and cross-user ownership",
    async () => {
      const other = await register("other@integration.test");
      secondCookie = await login(other.email);
      for (const suffix of ["", "/qr", "/stats"])
        assert.equal(
          (
            await request("/api/links/" + link.id + suffix, {
              cookie: secondCookie,
            })
          ).status,
          404,
        );
      assert.equal(
        (
          await request("/api/links/" + link.id, {
            method: "PATCH",
            cookie: secondCookie,
            body: { isActive: false },
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await request("/api/links", {
            method: "POST",
            cookie,
            headers: { Origin: "https://evil.example" },
            body: { originalUrl: "https://example.com" },
          })
        ).status,
        403,
      );
      assert.equal((await request("/internal/visits")).status, 404);
      assert.equal(
        (
          await request("/internal/visits", {
            method: "POST",
            port: 3103,
            body: {},
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/links/" + link.id, {
            cookie: secondCookie,
            headers: { "x-user-id": owner.id },
          })
        ).status,
        404,
      );
    },
  );
  await check(
    "Disabled, expired and unknown links never increase counts",
    async () => {
      assert.equal(
        (
          await request("/api/links/" + link.id, {
            method: "PATCH",
            cookie,
            body: { isActive: false },
          })
        ).status,
        200,
      );
      assert.equal((await request("/s/" + link.code)).status, 410);
      await clients.links.link.update({
        where: { id: link.id },
        data: { isActive: true, expiresAt: new Date(0) },
      });
      assert.equal((await request("/s/" + link.code)).status, 410);
      assert.equal((await request("/s/unknown-code")).status, 404);
      assert.equal(
        await clients.analytics.clickEvent.count({
          where: { linkId: link.id },
        }),
        21,
      );
      await clients.links.link.update({
        where: { id: link.id },
        data: { expiresAt: null },
      });
    },
  );
  await check(
    "Analytics outage returns 503 and HEAD remains available",
    async () => {
      await stop("analytics");
      const response = await request("/s/" + link.code);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("location"), null);
      assert.equal(
        (await request("/s/" + link.code, { method: "HEAD" })).status,
        302,
      );
      await start(
        "analytics",
        "services/analytics-service",
        3103,
        urls.analytics,
      );
      assert.equal(
        await clients.analytics.clickEvent.count({
          where: { linkId: link.id },
        }),
        21,
      );
    },
  );
  await check(
    "Auth outage denies protected endpoints; public redirects still work",
    async () => {
      await stop("auth");
      assert.equal((await request("/api/links", { cookie })).status, 503);
      assert.equal((await request("/s/" + link.code)).status, 302);
      await start("auth", "services/auth-service", 3101, urls.auth);
      assert.equal((await request("/api/auth/me", { cookie })).status, 200);
    },
  );
  await check(
    "Link outage returns 503 and restart preserves links",
    async () => {
      await stop("links");
      assert.equal((await request("/s/" + link.code)).status, 503);
      await start("links", "services/link-service", 3102, urls.links);
      assert.equal(
        (await request("/api/links/" + link.id, { cookie })).status,
        200,
      );
    },
  );
  await check(
    "Concurrent database rate limit, session expiry and logout revoke",
    async () => {
      const responses = await Promise.all(
        Array.from({ length: 110 }, () =>
          request("/api/links", {
            method: "POST",
            cookie,
            body: { originalUrl: "https://example.com" },
          }),
        ),
      );
      assert.ok(responses.some((response) => response.status === 429));
      for (const response of responses)
        assert.ok([201, 429].includes(response.status));
      await clients.auth.session.updateMany({
        where: { userId: owner.id },
        data: { expiresAt: new Date(0) },
      });
      assert.equal((await request("/api/links", { cookie })).status, 401);
      cookie = await login(owner.email);
      assert.equal(
        (await request("/api/auth/logout", { method: "POST", cookie })).status,
        204,
      );
      assert.equal((await request("/api/auth/me", { cookie })).status, 401);
    },
  );
  console.log(
    "All " + results.length + " real-PostgreSQL integration scenarios passed.",
  );
} catch (error) {
  console.error(error);
  results.push({
    name: "Integration execution",
    status: "failed",
    message: error.message,
  });
  process.exitCode = 1;
} finally {
  for (const name of Object.keys(processes)) await stop(name);
  for (const client of Object.values(clients)) await client.$disconnect();
  mkdirSync(resolve(root, "docs/evidence"), { recursive: true });
  writeFileSync(
    resolve(root, "docs/evidence/integration.json"),
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2),
  );
}
