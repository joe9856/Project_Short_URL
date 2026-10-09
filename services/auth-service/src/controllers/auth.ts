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
export async function register(req: Request, res: Response) {
  const input = credentials.extend({ name: displayName }).parse(req.body);
  const user = await registerUser(input);
  res.status(201).json({ user });
}
export async function login(req: Request, res: Response) {
  const input = credentials.parse(req.body);
  const user = await loginUser(input.email, input.password);
  const token = await createSession(user.id);
  res.setHeader("Set-Cookie", sessionCookie(token));
  res.json({ user });
}
export async function me(req: Request, res: Response) {
  res.json({ user: await getUserFromSession(req.headers.cookie) });
}
export async function updateProfile(req: Request, res: Response) {
  const input = z.object({ name: displayName }).strict().parse(req.body);
  res.json({ user: await updateUserName(req.headers.cookie, input.name) });
}
export async function logout(req: Request, res: Response) {
  await logoutSession(req.headers.cookie);
  res.setHeader("Set-Cookie", sessionCookie("", true));
  res.status(204).end();
}
