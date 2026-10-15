import type { Request, Response } from "express";
import { z } from "zod";
import {
  registerUser,
  loginUser,
  createSession,
  getUserFromSession,
  logoutSession,
  sessionCookie,
  updateUserName,
} from "../services/auth";
// ตรวจข้อมูล req.body ก่อนเรียก Service; parse ไม่ผ่านโยน ZodError → lib/http.ts errorHandler ตอบ 400
const displayName = z
  .string()
  .trim()
  .min(1, "กรุณากรอกชื่อ")
  .max(80, "ชื่อยาวได้ไม่เกิน 80 ตัวอักษร");
const credentials = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(128),
  })
  .strict();
// Route สมัครรับ Body จาก AuthPage → ตรวจชื่อ/บัญชี → registerUser → 201 { user } กลับ AuthPage
export async function register(req: Request, res: Response) {
  const input = credentials.extend({ name: displayName }).parse(req.body);
  const user = await registerUser(input);
  res.status(201).json({ user });
}
// Route Login → loginUser ตรวจรหัสผ่าน → createSession บันทึก Session → ส่ง Cookie และข้อมูลบัญชีกลับ Browser
export async function login(req: Request, res: Response) {
  const input = credentials.parse(req.body);
  const user = await loginUser(input.email, input.password);
  const token = await createSession(user.id);
  res.setHeader("Set-Cookie", sessionCookie(token)); // Browser เก็บ token ใน Cookie; api.ts ส่ง Cookie นี้ในคำขอถัดไป
  res.json({ user });
}
// App หรือ Middleware ของ Gateway/Service ส่ง Cookie มา → getUserFromSession → { user } กลับผู้เรียก
export async function me(req: Request, res: Response) {
  res.json({ user: await getUserFromSession(req.headers.cookie) });
}
// ProfilePage ส่งชื่อใหม่และ Cookie → updateUserName หาเจ้าของจาก Session → { user } กลับไปอัปเดต State ใน App
export async function updateProfile(req: Request, res: Response) {
  const input = z.object({ name: displayName }).strict().parse(req.body);
  res.json({ user: await updateUserName(req.headers.cookie, input.name) });
}
// App.logout เรียก → logoutSession ลบ Session จาก DB → ล้าง Cookie → 204 ไม่มี JSON ให้ api.ts คืน undefined
export async function logout(req: Request, res: Response) {
  await logoutSession(req.headers.cookie);
  res.setHeader("Set-Cookie", sessionCookie("", true));
  res.status(204).end();
}
