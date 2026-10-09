# Project_Short_URL — Short URL Microservices

เว็บจัดการลิงก์สั้นภาษาไทย: React/Vite, Express Gateway, Auth/Link/Analytics และ Prisma 6.19.3 เป้าหมาย deploy: **Frontend และ Backend บน Vercel, PostgreSQL บน Supabase**

สร้าง Short URL/QR, ประวัติ/สถิติคลิก, alias, วันหมดอายุ, ปิดลิงก์, สมัครสมาชิก/login/logout และแก้ชื่อบัญชี แต่ละ service มี Prisma schema/client/migrations และ credential ฐานข้อมูลของตัวเอง ไม่อ่านตาราง service อื่นโดยตรง

## เริ่มในเครื่อง

ใช้ Node.js 22.12+ และ PostgreSQL 17 หรือ Docker:

```sh
npm ci
npm run setup
docker compose up -d --wait postgres
npm run generate
npm run migrate
npm run dev
```

ถ้าไม่ใช้ Docker ใช้ `npm run db:local` แทนคำสั่งเริ่ม DB ดู [PostgreSQL ในเครื่อง](docs/local-postgres.md) รวมถึงการเปลี่ยน .env ของ MySQL โดยสำรองค่าเดิมไว้

เปิด [เว็บในเครื่อง](http://localhost:5173/register) แล้วสมัครบัญชีทดสอบใหม่ ไม่มีบัญชี/password ที่ฝังใน source

| ส่วน | พอร์ต |
|---|---|
| Frontend | 5173 |
| Gateway | 3000 |
| Auth / Link / Analytics | 3001 / 3002 / 3003 |
| PostgreSQL ในเครื่อง | 5544 |

## Deploy และส่งงาน

ทำตาม [คู่มือ Vercel + Supabase](docs/deployment.md) ตั้ง Vercel 5 projects และ Supabase 1 project แยก 3 schemas ยังต้องกรอก credentials/URLs จริงและทดสอบ cloud ก่อนส่งงาน

ส่ง repository ที่ผู้ตรวจเข้าถึงได้, Frontend URL พร้อมใช้, บัญชีทดสอบที่สมัครผ่านเว็บ และ diagrams อย่า commit .env หรือใช้ password ฐานข้อมูลเป็นบัญชีทดสอบ

## ทดสอบ

```sh
npm run verify
npm run test:integration
npm run test:e2e
```

Unit/API tests ใช้ mocks ที่ระบุในไฟล์ Integration ใช้ PostgreSQL จริงเฉพาะ short_url_test ตรวจ migrations/สิทธิ์เจ้าของ/concurrency/QR/สถิติ/หยุดและเริ่ม service E2E ทดสอบ desktop/tablet/mobile

## เอกสาร

- [Architecture](docs/architecture.md), [Architecture Diagram](docs/diagrams/architecture.mmd)
- [DFD Level 0](docs/diagrams/dfd-level-0.mmd), [ER Diagram](docs/diagrams/er.mmd)
- [API](docs/api.md), [อ่านโค้ด](docs/learning-guide.md)
- [สิ่งที่เปลี่ยนเมื่อใช้ PostgreSQL](docs/postgres-changes.md)
- [ผลตรวจ PostgreSQL/Vercel](docs/postgres-verification.md)

Auth เก็บ opaque session token hash ใน DB และส่ง cookie HttpOnly/SameSite/Secure ใน production Gateway ตรวจ Origin และส่ง internal secret ให้ services แต่ละ service ตรวจเจ้าของข้อมูลเอง บันทึก click ให้ Analytics สำเร็จก่อนตอบ 302 และ retry ด้วย eventId เดิมเพื่อไม่บวกซ้ำ

Deploy services แยกกันได้ แต่มี dependencies ระหว่างกันและใช้ PostgreSQL instance ร่วม Database ล่มจึงอาจกระทบทุก service ดู Architecture สำหรับรายละเอียด
