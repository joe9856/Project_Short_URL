import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { reservedNames } from "@short/routing";
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    link: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    rateLimit: { upsert: vi.fn() },
  },
}));
import { prisma } from "../src/lib/prisma";
import { app } from "../src/app";
import {
  createLink,
  redirectDestination,
  ownedLink,
  generateQr,
  publicLink,
} from "../src/services/links";
import {
  createSchema,
  generateCode,
  validDestination,
  linkUnavailable,
  getDevice,
  getReferrer,
} from "../src/lib/validation";
const link = {
  id: "7b0cdcef-4da0-43b8-a546-f79c4a7a4411",
  userId: "5b0cdcef-4da0-43b8-a546-f79c4a7a4411",
  originalUrl: "https://example.com/a?x=1#part",
  code: "abc12345",
  isActive: true,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.link.findUnique).mockResolvedValue(link);
});
afterEach(() => vi.unstubAllGlobals());
describe("Link service", () => {
  it("validates destinations and aliases", () => {
    for (const value of [
      "javascript:alert(1)",
      "ftp://example.com",
      "https://name:pass@example.com",
      "nonsense",
    ])
      expect(validDestination(value)).toBe(false);
    expect(validDestination(link.originalUrl)).toBe(true);
    expect(() =>
      createSchema.parse({ originalUrl: link.originalUrl, alias: "??" }),
    ).toThrow();
  });
  it("generates 8-character secure codes", () => {
    const codes = new Set();
    for (let i = 0; i < 1000; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[A-Za-z0-9]{8}$/);
      codes.add(code);
    }
    expect(codes.size).toBe(1000);
  });
  it("rejects reserved aliases regardless of letter case", () => {
    for (const name of reservedNames) {
      for (const alias of [name, name.toUpperCase()]) {
        expect(() => createSchema.parse({ originalUrl: link.originalUrl, alias })).toThrow();
      }
    }
    expect(createSchema.parse({ originalUrl: link.originalUrl, alias: "login-123" }).alias).toBe("login-123");
  });
  it("serves root and legacy HEAD links without recording clicks", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const path of ["/" + link.code, "/s/" + link.code]) {
      const response = await request(app).head(path).set("x-internal-key", "unit-test-secret-only-not-for-deployment");
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(link.originalUrl);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(publicLink(link).shortUrl).toBe("http://localhost:5173/" + link.code);
  });
  it("keeps reserved legacy links usable without taking over root page routes", async () => {
    vi.mocked(prisma.link.findUnique).mockResolvedValue({ ...link, code: "Login" });
    const response = await request(app).head("/s/Login").set("x-internal-key", "unit-test-secret-only-not-for-deployment");
    expect(response.status).toBe(302);
    expect(publicLink({ ...link, code: "Login" }).shortUrl).toBe("http://localhost:5173/s/Login");
    vi.mocked(prisma.link.findUnique).mockClear();
    const root = await request(app).head("/Login").set("x-internal-key", "unit-test-secret-only-not-for-deployment");
    expect(root.status).toBe(404);
    expect(prisma.link.findUnique).not.toHaveBeenCalled();
  });
  it("retries generated collisions and rejects duplicate aliases", async () => {
    vi.mocked(prisma.link.create)
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValueOnce(link);
    expect(
      await createLink(link.userId, { originalUrl: link.originalUrl }),
    ).toEqual(link);
    expect(prisma.link.create).toHaveBeenCalledTimes(2);
    vi.mocked(prisma.link.create).mockRejectedValue({ code: "P2002" });
    await expect(
      createLink(link.userId, {
        originalUrl: link.originalUrl,
        alias: "duplicate",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("denies cross-user ownership", async () => {
    vi.mocked(prisma.link.findFirst).mockResolvedValue(null);
    await expect(ownedLink(link.id, "another")).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.link.findFirst).toHaveBeenCalledWith({
      where: { id: link.id, userId: "another" },
    });
  });
  it("HEAD does not call analytics and preserves URL query/fragment", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await redirectDestination(link.code, true, "")).toBe(
      link.originalUrl,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("disabled, expired, and unknown redirects do not record events", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(prisma.link.findUnique).mockResolvedValue({
      ...link,
      isActive: false,
    });
    await expect(
      redirectDestination(link.code, false, ""),
    ).rejects.toMatchObject({ status: 410 });
    vi.mocked(prisma.link.findUnique).mockResolvedValue({
      ...link,
      expiresAt: new Date(0),
    });
    await expect(
      redirectDestination(link.code, false, ""),
    ).rejects.toMatchObject({ status: 410 });
    vi.mocked(prisma.link.findUnique).mockResolvedValue(null);
    await expect(
      redirectDestination(link.code, false, ""),
    ).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("retries with the same eventId and only redirects after acknowledgment", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ recorded: true }), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await redirectDestination(
        link.code,
        false,
        "iPhone mobile",
        "https://news.example.com/path",
      ),
    ).toBe(link.originalUrl);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchMock.mock.calls[0][1].body);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(first.eventId).toBe(second.eventId);
    expect(first.deviceType).toBe("mobile");
    expect(first.referrerHost).toBe("news.example.com");
  });
  it("fails closed during analytics outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const response = await request(app)
      .get("/s/" + link.code)
      .set("x-internal-key", "unit-test-secret-only-not-for-deployment");
    expect(response.status).toBe(503);
    expect(response.headers.location).toBeUndefined();
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it("QR PNG and SVG encode the short URL and preserve quiet zone", async () => {
    const svg = await generateQr(link, "svg");
    const png = await generateQr(link, "png");
    expect(String(svg)).toContain("<svg");
    const decoded = PNG.sync.read(png as Buffer);
    const result = jsQR(
      new Uint8ClampedArray(decoded.data),
      decoded.width,
      decoded.height,
    );
    expect(result?.data).toBe("http://localhost:5173/" + link.code);
    for (let index = 0; index < decoded.width * 20 * 4; index += 4)
      expect(decoded.data[index]).toBe(255);
  });
  it("classifies status, devices and source safely", () => {
    expect(linkUnavailable(link)).toBe(false);
    expect(getDevice("iPad")).toBe("tablet");
    expect(getReferrer("bad")).toBe("direct");
  });
});
