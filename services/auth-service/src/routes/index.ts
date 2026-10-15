import { Router } from "express";
import * as controller from "../controllers/auth";
import { databaseRateLimit } from "../middlewares/rateLimit";
// app.ts ติดตั้ง Router นี้; Method/path เลือก Controller ใน controllers/auth.ts ไม่ใช่ path หน้าจอ React
export const router = Router();
// AuthPage ส่ง name/email/password → Rate limit → register → 201 { user }; ยังไม่สร้าง Session ใน Route นี้
router.post(
  "/api/auth/register",
  databaseRateLimit("register", 10, 900),
  controller.register,
);
router.post(
  "/api/auth/login", // AuthPage ส่ง email/password → login → { user } และ Set-Cookie กลับผ่าน Gateway
  databaseRateLimit("login", 30, 900),
  controller.login,
);
// App.logout ส่ง Cookie → logout ลบ Session/ล้าง Cookie → ตอบ 204 ให้ App ล้าง user
router.post("/api/auth/logout", controller.logout);
// Effect ใน App ส่ง Cookie → me คืนบัญชีปัจจุบัน หรือ 401 ถ้า Session ใช้ไม่ได้
router.get("/api/auth/me", controller.me);
router.patch("/api/auth/me", controller.updateProfile); // ProfilePage ส่ง { name } → updateProfile → { user } กลับไป onUpdated
router.post("/internal/sessions/verify", controller.me); // Gateway/Link/Analytics เรียกตรวจ Cookie ภายใน ได้ { user } แบบเดียวกับ me
