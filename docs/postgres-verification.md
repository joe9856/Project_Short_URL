# PostgreSQL / Vercel preparation verification — 2026-10-10

ตรวจที่ D:/Project_microservices/short-url-microservices บน Windows กับ PostgreSQL **17.2 จริง** หนึ่ง instance สาม schemas/roles ใช้ short_url_test สำหรับ integration แยกจาก short_url สำหรับ dev/browser

| Check | Result |
|---|---|
| TypeScript + ESLint | ผ่าน |
| Vitest unit/API | 42 ผ่าน |
| Frontend + 4 backend builds | 5 ผ่าน |
| PostgreSQL integration | 15 สถานการณ์ผ่าน |
| Browser E2E desktop/tablet/mobile | 9 ผ่าน |
| Official Vercel JSON schema | 5 configs ผ่าน |
| Compose / production overlay config | ผ่าน |

Integration ตรวจสิทธิ์ข้าม schema, session, UNIQUE, concurrent create/click, idempotent events, QR, สถิติ, outage/restart และ rate limit รวมกรณีตัวพิมพ์เล็ก–ใหญ่และข้ามเที่ยงคืนไทย E2E ตรวจสมัคร/login/สร้าง/QR/redirect/stats/ปิดลิงก์/logout/แก้ชื่อ/refresh/cursor

Migrations PostgreSQL สร้างตารางด้วยบัญชีเจ้าของ schema ไม่ต้องให้สิทธิ์ CREATE DATABASE หรือ superuser ตั้ง schema ไว้ก่อนและไม่สร้าง public schema ใน migration

Vercel configs ตรวจด้วย schema จาก https://openapi.vercel.sh/vercel.json เท่านั้น ยังไม่ได้ยืนยันด้วย Vercel build/deploy ในบัญชีจริง และยังไม่ได้เชื่อม Supabase จริง ต้องตรวจ pooler, roles, deployed cookies/rewrites และ limits เมื่อมีค่าจริง

ผู้ใช้เลือกเริ่มฐานทดสอบใหม่ ไม่ย้าย MySQL data สำรอง .env เดิมที่ .local/previous-mysql-env และเก็บ schema/migrations เดิมที่ docs/legacy-mysql ไม่ลบข้อมูล MySQL

หลักฐาน: docs/evidence/postgres-vercel.json และ docs/evidence/integration.json เอกสารผลตรวจ MySQL ก่อนหน้านี้เป็นประวัติ ไม่ใช่หลักฐานว่ารันกับ Supabase/Vercel แล้ว
