import "dotenv/config";
// อ่าน Environment หลัง dotenv โหลด; HTTP helpers ใช้ URL/secret นี้ส่งต่อไป Auth/Link/Analytics
export const config = {
  appUrl: new URL(process.env.APP_URL || "http://localhost:5173").origin, // ที่อยู่หน้าเว็บ ใช้ตรวจ origin และประกอบ Short URL
  secret: process.env.INTERNAL_API_SECRET || "",
  authUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  linkUrl: process.env.LINK_SERVICE_URL || "http://localhost:3002",
  analyticsUrl: process.env.ANALYTICS_SERVICE_URL || "http://localhost:3003",
  production: process.env.NODE_ENV === "production",
};
// server.ts เรียกก่อน listen และ app.ts เรียกบน Vercel; ค่าผิดจะ throw แทนการเปิด Service
export function validateConfig() {
  if (config.secret.length < 32 || config.secret.includes("<"))
    throw new Error("Set INTERNAL_API_SECRET to at least 32 random characters");
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required for this service");
  if (config.production && !config.appUrl.startsWith("https://"))
    throw new Error("Production APP_URL must use HTTPS");
}
