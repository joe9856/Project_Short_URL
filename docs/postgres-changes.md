# เปลี่ยนจาก MySQL เป็น PostgreSQL

SQL ที่เรียนมาใช้ต่อได้ เช่น SELECT/INSERT/UPDATE/DELETE/JOIN Backend ส่วนใหญ่เรียก Prisma จึงไม่ต้องเปลี่ยน controller ทุกไฟล์

| ส่วน | เดิม | ปัจจุบัน |
|---|---|---|
| Prisma datasource | mysql | postgresql + DIRECT_URL สำหรับ migrate |
| เวลา | DATETIME(3) เก็บ UTC | TIMESTAMPTZ(3) |
| SQL สถิติ | DATE_ADD + DATE_FORMAT | AT TIME ZONE 'Asia/Bangkok' + to_char |
| ชื่อคอลัมน์ SQL | ownerId / clickedAt | "ownerId" / "clickedAt" |
| ค้นหา URL | collation ไม่แยกตัวพิมพ์ | Prisma mode: insensitive |
| shortcode | binary collation | PostgreSQL equality แยกตัวพิมพ์ |
| พื้นที่ข้อมูล | MySQL 3 databases | PostgreSQL 1 instance, 3 schemas/roles |
| production connections | เชื่อมแต่ละ DB | Supabase transaction pooler สำหรับ Vercel |

schema.prisma/migrations ของ 3 services, analytics.ts, links.ts, setup/local-postgres/integration scripts, Compose และ CI เปลี่ยนตามนี้

SQL MySQL เดิมเก็บใน docs/legacy-mysql เพื่ออ้างอิง โค้ดปัจจุบันใช้ migrations PostgreSQL ใหม่ ผู้ใช้เลือกเริ่มฐานข้อมูลทดสอบใหม่จึงไม่ย้ายข้อมูลเดิมอัตโนมัติ หากต้องย้ายภายหลังต้องตรวจ UUID/จำนวนข้อมูล/UTC/ยอดคลิกด้วย
