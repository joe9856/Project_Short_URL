# Architecture

Browser → Frontend Vercel (React) → same-origin rewrite → Gateway Vercel (Express) → Auth/Link/Analytics Vercel Functions → Supabase PostgreSQL

Deploy 5 projects จาก repository เดียว แต่ละ backend เป็น Express app คนละ Function default export อยู่ src/app.ts ส่วน server.ts ใช้ listener ในเครื่อง Deploy service แยกได้โดยรักษา API contract ระหว่างกัน

Supabase ใช้ instance เดียว แยก app_auth/app_links/app_analytics และ auth_owner/links_owner/analytics_owner แต่ละ service มี Prisma client/schema/migrations/credential ของตัวเอง ไม่ใช้ admin credential ใน runtime ไม่ใช้ Supabase Auth แทน session เดิม Runtime ใช้ transaction pooler ส่วน migrations ใช้ DIRECT_URL แบบ direct/session และไม่รันใน Vercel build

## Data flow

1. Login: POST /api/auth/login → Gateway ตรวจ Origin → Auth ตรวจ password → เก็บ session hash → ส่ง cookie กลับ browser บน frontend domain
2. Create: Gateway ตรวจ session กับ Auth → Link ตรวจ session/URL/alias → INSERT app_links.links → คืน Short URL ที่ขึ้นต้น APP_URL ของ frontend
3. Redirect: GET /s/code → Link อ่านลิงก์ → ส่ง eventId ให้ Analytics → INSERT click_events และรับ acknowledgment → 302 ไป URL เดิม Retry ใช้ eventId เดิม HEAD ไม่บันทึกคลิก
4. History: Link อ่านลิงก์ของผู้ใช้ → ขอ batch click counts จาก Analytics → คืนรายการพร้อมยอดคลิก
5. Stats: Analytics ตรวจ session/ownership/summary ผ่าน Auth/Link → aggregate PostgreSQL ใน RepeatableRead snapshot → กราฟวันที่ไทย/device/source
6. Profile: PATCH /api/auth/me → Auth อ่านผู้ใช้จาก session → แก้เฉพาะ name → frontend อัปเดตชื่อ

userId/linkId/ownerId ระหว่าง services เป็น logical references ไม่ใช้ foreign key ข้าม schema User–Session มี foreign key ภายใน Auth เท่านั้น

## การล่มและข้อจำกัด

Auth หยุด: protected API ใช้ไม่ได้ แต่ public redirect ยังใช้ Link/Analytics ได้ Link หยุด: สร้าง/เปิดลิงก์ใช้ไม่ได้ Analytics หยุด: GET redirect ตอบ 503 ตามนโยบายยืนยันบันทึกคลิกก่อน redirect แต่ HEAD ยังตรวจลิงก์ได้ การแบ่ง services จึงไม่ได้ทำให้ทุกฟังก์ชันเป็นอิสระจากกัน

PostgreSQL instance ร่วมเป็นจุดพึ่งพาร่วม หาก instance ไม่พร้อมทุก service ที่ใช้ DB จะกระทบ Schema/roles แยกสิทธิ์ได้แต่ไม่แยก failure ของ database

Vercel เปิด/พัก Functions ตามคำขอ ข้อมูลถาวรอยู่ PostgreSQL ไม่อยู่ RAM/filesystem ของ Function Auth/Create rate limit ใช้ DB ส่วน Gateway ใช้ memory ของแต่ละ instance เท่านั้น /healthz ตรวจ app, /readyz query SELECT 1 ไม่รับรอง dependencies ทุกตัว

## Diagrams

Architecture: diagrams/architecture.mmd; DFD Level 0: diagrams/dfd-level-0.mmd; ER: diagrams/er.mmd และ auth-er/links-er/analytics-er.mmd; Sequence: diagrams/sequences.mmd
