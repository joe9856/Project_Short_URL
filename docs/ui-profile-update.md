# UI และแก้ชื่อบัญชี

ปรับเมื่อ 10 ตุลาคม 2026 (Asia/Bangkok) ใน `D:\Project_microservices\short-url-microservices`
ตาม UI และฟังก์ชันบัญชีของ `D:\Projects\short-url-microservices`

## การเปลี่ยนแปลง

- ใช้แบรนด์ Short URL รูปแบบขาว–แดง ภาพ QR ตัวอย่างบนหน้าแรก และฟอร์มสมัคร/เข้าสู่ระบบกลางหน้า
- ใช้ Navigation และ Workspace ร่วมกัน พร้อม sidebar บน desktop และเมนูด้านบนบน tablet/mobile
- ปรับฟอร์มสร้างลิงก์ ผลลัพธ์/QR ประวัติ รายละเอียด และสถิติให้ใช้รูปแบบเดียวกับต้นแบบ
- เพิ่ม `/profile` หรือเมนู “บัญชีของฉัน” สำหรับแก้ชื่อ 1–80 ตัวอักษรหลังตัดช่องว่างหัวท้าย
- เพิ่ม `PATCH /api/auth/me` รับเฉพาะ `{name}` เลือกบัญชีจาก session ตรวจ Origin/internal key และคืนเฉพาะ id/name/email
- เมื่อบันทึกสำเร็จ ชื่อใหม่แสดงในเมนูและแดชบอร์ด และคงอยู่หลังรีเฟรช/เข้าสู่ระบบใหม่
- เมื่อบันทึกผิดพลาด เก็บค่าที่พิมพ์ให้ลองใหม่ ระหว่างบันทึกปิดช่องกรอกและปุ่ม

ไม่มีการเพิ่ม dependency หรือเปลี่ยน schema/migrations ระบบใช้ชื่อในตาราง User เดิม
โค้ด Gateway, Link Service และ Analytics Service ใช้ชุดเดิม
สำเนาไฟล์ก่อนปรับอยู่ใน `.local/ui-profile-backup-20261010-014119` ซึ่ง Git ignore

## ผลตรวจจริงในโฟลเดอร์นี้

- `npm run verify` ผ่าน TypeScript ทั้ง 5 workspaces, ESLint, 40 Vitest/Supertest tests และ builds ทุก workspace
- `npx playwright test --config .local/playwright-current.config.ts` ผ่าน 9 tests โดยใช้ชุดแอปที่กำลังรันและ MySQL จริงของโปรเจกต์นี้
- Browser tests ใช้ Chromium ที่ desktop 1440×1000, tablet 768×1024 และ mobile 390×844
- ตรวจแก้ชื่อหลัง reload/login, ชื่อว่าง, การส่ง ID ปลอม, logout/session, error ที่เก็บค่าฟอร์ม และ cursor ของหัวข้อ/input/button
- ตรวจสมัคร/login/create/QR PNG+SVG/redirect/สถิติ/disable/410/history/logout และ keyboard skip link
- Render หน้าแรกและสมัครสมาชิกทั้งสามขนาด: ไม่มี page errors, ไม่มี horizontal overflow และมี main landmark หนึ่งจุด
- ตรวจภาพจริงของหน้าแรก desktop/mobile, โปรไฟล์ desktop/mobile, รายละเอียด desktop และประวัติ tablet
- เทียบ frontend/src ทั้ง 16 ไฟล์กับต้นแบบ: เนื้อหาเหมือนกันทุกไฟล์
- Frontend, Gateway และ readiness ของทั้งสาม services ตอบ HTTP 200; โปรเซส frontend รันจากโฟลเดอร์ที่แก้ไขนี้

ภาพจาก E2E อยู่ใน `test-results/` ภาพหน้าแรก/สมัครสมาชิกอยู่ใน `.local/ui-review/`
การตรวจครั้งนี้เป็นการทำงานในเครื่อง ไม่มีการ deploy ภายนอกหรือรัน full Docker stack

## ใช้งาน

เปิด http://localhost:5173 แล้วเลือก “บัญชีของฉัน” หรือ http://localhost:5173/profile หลังเข้าสู่ระบบ
หาก browser ยังแสดง UI เดิม ให้กด Ctrl+F5
