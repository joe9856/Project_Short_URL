# PostgreSQL ในเครื่อง

PostgreSQL 17 หนึ่ง instance แยก schemas/บัญชี auth, links, analytics มีฐานพัฒนา short_url และฐานทดสอบ short_url_test แยกกัน

```sh
npm ci
npm run setup
docker compose up -d --wait postgres
npm run generate
npm run migrate
npm run dev
```

ถ้าไม่ใช้ Docker เปลี่ยนคำสั่งเริ่ม DB เป็น `npm run db:local` เครื่องนี้มี binaries ใน D:/postgresql/bin หากติดตั้งตำแหน่งอื่นให้ตั้ง POSTGRES_BIN หรือบน Linux ใส่ initdb/pg_ctl/psql ใน PATH

สคริปต์สร้าง instance เฉพาะโปรเจกต์ที่ .local/postgresql/data และพอร์ต 5544 ไม่เปลี่ยนบริการฐานข้อมูลอื่น เลือก Docker หรือ portable อย่างใดอย่างหนึ่งสำหรับพอร์ตเดียวกัน `npm run db:stop` หยุดเฉพาะ portable instance นี้

ถ้ามี .env ของ MySQL ใช้ `npm run setup -- --switch-from-mysql` แทน setup ปกติ โดยหยุด dev เดิมก่อน ค่าเดิมสำรองไป .local/previous-mysql-env ไม่ลบข้อมูล MySQL เริ่ม PostgreSQL ใหม่จึงต้องสมัครบัญชีทดสอบใหม่

```sh
npm run verify
npm run test:integration
npm run test:e2e
```

Integration เชื่อม PostgreSQL จริงที่ localhost ใช้และล้างเฉพาะ short_url_test ก่อนเปิด API ที่พอร์ต 3100–3103 E2E ใช้ฐานพัฒนาและสร้างข้อมูลผ่าน browser ไม่ล้างฐานพัฒนา ไม่ commit .local หรือ .env
