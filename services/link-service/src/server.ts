import { app } from "./app";
import { prisma } from "./lib/prisma";
import { validateConfig } from "./lib/config";
validateConfig(); // lib/config.ts ตรวจค่าตั้งระบบก่อนเปิดพอร์ต; ไม่ผ่านจะหยุดเริ่ม Service
// เปิด HTTP server ให้ Gateway/Service อื่นส่ง Request เข้ามาที่ app.ts
const server = app.listen(
  Number(process.env.PORT || 3002),
  process.env.HOST || "127.0.0.1",
  () => console.log("link-service ready"),
);
// SIGTERM/Ctrl+C → หยุด HTTP server และตัด connection ฐานข้อมูลผ่าน Prisma
async function shutdown() {
  server.close();
  await prisma.$disconnect();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
