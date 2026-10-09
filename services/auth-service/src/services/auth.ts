import { randomBytes, createHash } from "node:crypto";
import argon2 from "argon2";
import { parse, serialize } from "cookie";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import { config } from "../lib/config";
const sessionSeconds = 60 * 60 * 24 * 7;
function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function sessionCookie(token: string, clear = false) {
  return serialize("short_session", token, {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/",
    maxAge: clear ? 0 : sessionSeconds,
  });
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  // เก็บเพียง hash ของ token ถ้า DB รั่ว จะนำ token ไปใช้ไม่ได้โดยตรง
  await prisma.session.create({
    data: {
      tokenHash: tokenHash(token),
      userId,
      expiresAt: new Date(Date.now() + sessionSeconds * 1000),
    },
  });
  return token;
}
export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  try {
    return await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        createdAt: new Date(),
      },
      select: { id: true, name: true, email: true },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      throw new HttpError(409, "EMAIL_EXISTS", "อีเมลนี้ถูกใช้งานแล้ว");
    throw error;
  }
}
export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // ทำ Argon2 แม้อีเมลไม่มี เพื่อลดความต่างของเวลาในการตอบ
  if (!user) {
    await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    throw new HttpError(
      401,
      "INVALID_CREDENTIALS",
      "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    );
  }
  if (!(await argon2.verify(user.passwordHash, password)))
    throw new HttpError(
      401,
      "INVALID_CREDENTIALS",
      "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    );
  return { id: user.id, name: user.name, email: user.email };
}
export async function getUserFromSession(cookie?: string) {
  const token = parse(cookie || "").short_session;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(401, "UNAUTHORIZED", "กรุณาเข้าสู่ระบบ");
  const session = await prisma.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!session || session.expiresAt <= new Date())
    throw new HttpError(401, "SESSION_EXPIRED", "กรุณาเข้าสู่ระบบอีกครั้ง");
  return session.user;
}
export async function updateUserName(cookie: string | undefined, name: string) {
  // เลือกบัญชีจาก session เท่านั้น ไม่รับ userId จาก body หรือ header ของผู้ใช้
  const user = await getUserFromSession(cookie);
  return prisma.user.update({
    where: { id: user.id },
    data: { name },
    select: { id: true, name: true, email: true },
  });
}
export async function logoutSession(cookie?: string) {
  const token = parse(cookie || "").short_session;
  if (token)
    await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
}
