import { randomBytes, createHash } from "node:crypto";
import argon2 from "argon2";
import { parse, serialize } from "cookie";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import { config } from "../lib/config";
const sessionSeconds = 60 * 60 * 24 * 7;
// createSession/getUserFromSession/logoutSession ส่ง token มา → SHA-256 → คืน hash สำหรับเก็บหรือค้น Session ใน DB
function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
// Controller login/logout ส่ง token และตัวเลือกล้าง → คืนข้อความ Cookie ให้ res.setHeader("Set-Cookie", ...) ส่งไป Browser
export function sessionCookie(token: string, clear = false) {
  return serialize("short_session", token, {
    httpOnly: true, // Browser ส่ง Cookie ได้ แต่ JavaScript อ่าน token ด้วย document.cookie ไม่ได้
    secure: config.production,
    sameSite: "lax",
    path: "/",
    maxAge: clear ? 0 : sessionSeconds,
  });
}
// Controller login ส่ง user.id หลังตรวจรหัสผ่าน → สุ่ม token/บันทึก hash+เจ้าของ+หมดอายุ → คืน token จริงไป sessionCookie
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
// Controller register ส่งข้อมูลที่ตรวจแล้ว → Argon2id hash รหัสผ่าน → Prisma INSERT user → คืนเฉพาะ id/name/email
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
      select: { id: true, name: true, email: true }, // ข้อมูลนี้กลับถึง AuthPage; ไม่ส่ง passwordHash กลับ Frontend
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
// Controller login ส่ง email/password → Prisma หา user → Argon2 ตรวจ hash → คืนบัญชีให้ Controller สร้าง Session ต่อ
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
// Controller me/updateUserName ส่ง Cookie → อ่าน short_session → hash token ค้น Session+user → ตรวจหมดอายุ → คืนบัญชี
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
  return session.user; // controller.me ส่ง { user } ให้ App/Gateway/requireSession; ไม่คืน token หรือ passwordHash
}
// Controller updateProfile ส่ง Cookie/name → getUserFromSession หาเจ้าของ → UPDATE ชื่อ → คืนบัญชีให้ ProfilePage และ App
export async function updateUserName(cookie: string | undefined, name: string) {
  // เลือกบัญชีจาก session เท่านั้น ไม่รับ userId จาก body หรือ header ของผู้ใช้
  const user = await getUserFromSession(cookie);
  return prisma.user.update({
    where: { id: user.id },
    data: { name },
    select: { id: true, name: true, email: true },
  });
}
// Controller logout ส่ง Cookie → อ่าน/hash token → DELETE Session; จบแล้ว Controller ล้าง Cookie และตอบ 204
export async function logoutSession(cookie?: string) {
  const token = parse(cookie || "").short_session;
  if (token)
    await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
}
