// จุดเริ่มรัน Gateway ในเครื่อง/Container: import app.ts ซึ่งเรียก createGateway() เพื่อตั้ง Middleware และ Proxy
// บน Vercel ใช้ default app จาก app.ts เป็น HTTP handler; 
import { app } from "./app";
// secret นี้ใช้ทั้ง verifySession ที่ส่งไป Auth และ Proxy ที่ส่งไป Service; ตรวจค่าก่อนเปิดรับคำขอ
const secret = process.env.INTERNAL_API_SECRET || "";
if (secret.length < 32 || secret.includes("<"))
  throw new Error("Set a strong INTERNAL_API_SECRET");
// เปิดรับ HTTP ครั้งเดียวตอนเริ่มโปรแกรม; PORT/HOST กำหนดที่อยู่ Gateway ในเครื่อง ไม่ใช่ที่อยู่ Link Service
// ค่าเริ่มต้น 127.0.0.1:3000 รับคำขอจาก Vite proxy → app.ts → guards/verifySession → routes/proxy.ts
const server = app.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () => console.log("Gateway ready"),
);
// ระบบสั่งหยุดหรือกด Ctrl+C → ปิด HTTP server; Gateway ไม่มี Prisma connection ให้ปิด
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
