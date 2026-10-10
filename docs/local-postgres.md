# PostgreSQL ในเครื่อง

ระบบใช้ PostgreSQL 17 หนึ่ง instance แยกสคีมา `app_auth`, `app_links`, `app_analytics` และบัญชีฐานข้อมูลของแต่ละบริการ มีฐานพัฒนา `short_url` และฐานทดสอบ `short_url_test` แยกกัน

รันคำสั่งจากโฟลเดอร์หลักของ repository หลังติดตั้ง Git, Node.js และ npm แล้ว ดู [วิธีติดตั้งฉบับเต็ม](../README.md) สำหรับขั้นตอนเริ่มต้น

## วิธีหลัก: Docker Compose

เปิด Docker Desktop/Engine แล้วรัน:

```sh
npm ci
npm run setup
docker compose up -d --wait postgres
npm run generate
npm run migrate
npm run dev
```

ใช้ `setup` ครั้งแรกเท่านั้น หากมีไฟล์ `.env` อยู่แล้วและต้องการใช้ค่าเดิม ให้ข้ามขั้นตอนนี้ ฐานข้อมูลเปิดที่ `127.0.0.1:5544` และเก็บข้อมูลใน Docker volume

เปิดเว็บที่ [http://localhost:5173](http://localhost:5173) และสมัครบัญชีใหม่เพื่อทดสอบ ระบบไม่มีบัญชีเริ่มต้นที่ฝังในโค้ด

## ทางเลือก: PostgreSQL ที่ติดตั้งในเครื่อง

ใช้ PostgreSQL 17 และทำขั้นตอนเดิม แต่เปลี่ยนคำสั่ง `docker compose up -d --wait postgres` เป็น `npm run db:local`

บน Windows ตั้ง `POSTGRES_BIN` ให้ตรงกับโฟลเดอร์ `bin` ที่ติดตั้งจริง ตัวอย่างใน PowerShell:

```powershell
$env:POSTGRES_BIN = "C:\Program Files\PostgreSQL\17\bin"
npm run db:local
```

บน Linux ให้ `initdb`, `pg_ctl` และ `psql` อยู่ใน `PATH` และรันด้วยผู้ใช้ปกติ

สคริปต์สร้าง instance ของโปรเจกต์ไว้ใน `.local/postgresql/data` ที่พอร์ต 5544 พร้อมฐานพัฒนาและฐานทดสอบ จากนั้นรัน `npm run generate`, `npm run migrate` และ `npm run dev` ต่อ เลือกวิธีฐานข้อมูลเพียงวิธีเดียวสำหรับพอร์ตนี้

## หยุดและเริ่มใช้งานครั้งถัดไป

กด `Ctrl+C` ใน Terminal ที่รันระบบ แล้วหยุดฐานข้อมูลตามวิธีที่เลือก:

```sh
# Docker — เก็บข้อมูลใน volume ไว้
docker compose stop postgres

# PostgreSQL ของโปรเจกต์ — ใช้ POSTGRES_BIN เดียวกับตอนเริ่ม
npm run db:stop
```

ครั้งถัดไปเริ่มฐานข้อมูลด้วยคำสั่งเดิมและรัน `npm run dev` หากมี migrations ใหม่ ให้รัน `npm run migrate` ก่อน

## ทดสอบกับฐานข้อมูล

```sh
npm run verify
npm run test:integration
```

`verify` ตรวจ TypeScript, lint, unit/API tests และ build ส่วน Integration ใช้ PostgreSQL จริงและล้างข้อมูลเฉพาะ `short_url_test` โดยเริ่ม API ทดสอบที่พอร์ต 3100–3103

สำหรับ E2E ให้ปิด `npm run dev` ก่อน เปิดฐานข้อมูลพัฒนาไว้ แล้วรัน:

```sh
npx playwright install chromium
npm run test:e2e
```

E2E เริ่มระบบเองและสร้างข้อมูลผ่าน Browser ในฐานพัฒนา ไฟล์ `.env` และ `.local` เก็บไว้เฉพาะเครื่อง ดู [รายการทดสอบฟังก์ชัน](testing.md) สำหรับการตรวจผ่านหน้าจอ

[กลับสารบัญเอกสาร](README.md)
