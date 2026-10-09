# Deploy: Vercel + Supabase

ใช้ Vercel **5 projects** จาก repository เดียว และ Supabase PostgreSQL **1 project** แยก 3 schemas/บัญชีฐานข้อมูล ระบบสมัครสมาชิกและ session ใช้ Auth Service ของเราเหมือนเดิม

ไฟล์ตั้งค่าถูกเตรียมแล้ว แต่ **ยังไม่ได้ deploy หรือเชื่อมต่อบัญชี Supabase จริง** ต้องใส่ข้อมูลจากบัญชีของผู้ใช้ตามขั้นตอนต่อไปนี้

## 1. สร้าง Supabase และบัญชีฐานข้อมูล

สร้าง project ใหม่ เลือก region ใกล้ Vercel Functions เช่น Singapore เปิด SQL Editor และใช้ `infra/supabase-roles.sql` เปลี่ยน placeholders เป็น password สุ่ม hex คนละค่าก่อนรันเพียงครั้งเดียว สร้าง schemas `app_auth`, `app_links`, `app_analytics` ไม่ใช้ schema `auth` ของ Supabase

สร้าง secret/password ใหม่ทุกค่าได้ด้วย:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

อย่า commit SQL ที่กรอกรหัสผ่านแล้ว ในหน้า **Connect** คัดลอก Transaction pooler และ Session pooler ของ project จริง เปลี่ยน username จาก `postgres.PROJECT_REF` เป็นบัญชีของ service เช่น `auth_owner.PROJECT_REF` พร้อม password ของบัญชีนั้น

ตัวอย่าง Auth Service (ใช้ hostname จาก dashboard ไม่เดาจาก region):

```dotenv
# Runtime บน Vercel ใช้ Transaction pooler
DATABASE_URL=postgresql://auth_owner.PROJECT_REF:PASSWORD@POOLER_HOST:6543/postgres?schema=app_auth&pgbouncer=true&connection_limit=1&pool_timeout=20&sslmode=require
# Prisma migrations ใช้ Session pooler ที่รองรับ IPv4
DIRECT_URL=postgresql://auth_owner.PROJECT_REF:PASSWORD@POOLER_HOST:5432/postgres?schema=app_auth&sslmode=require
```

Link ใช้ `links_owner.PROJECT_REF` + `app_links`; Analytics ใช้ `analytics_owner.PROJECT_REF` + `app_analytics` Password ที่มีอักขระพิเศษต้อง URL-encode Direct connection `db.PROJECT_REF.supabase.co:5432` ใช้แทน DIRECT_URL ได้เมื่อเครื่องรองรับ IPv6

โค้ดนี้ใช้ **Prisma 6.19.3** ตั้ง directUrl ใน schema.prisma อย่านำตัวอย่าง prisma.config.ts ของรุ่นใหม่มาใช้แทนโดยไม่อัปเกรดโค้ดด้วย DATABASE_URL อยู่เฉพาะ backend ไม่ใส่ใน frontend หรือ `VITE_*` ไม่ต้องใช้ Supabase Auth SDK, anon key หรือ service_role key เก็บ 3 schemas นี้นอก Data API exposed schemas

## 2. สร้างตารางบน cloud

ใส่ DATABASE_URL/DIRECT_URL ของ cloud ใน `.env` แต่ละ service บนเครื่องที่จะรัน migrations อย่าเผยแพร่ไฟล์ .env แล้วรันจาก repository root:

```sh
npm ci
npm run generate
npm run migrate
```

Migrations ใหม่สร้างตาราง PostgreSQL ในพื้นที่ของแต่ละ service ไม่ย้ายข้อมูล MySQL อัตโนมัติ ห้ามใช้ migrate reset กับ cloud Vercel build ทำ generate/build เท่านั้น ไม่รัน migration เพื่อไม่ให้ Preview เปลี่ยนตาราง Production หากใช้ Preview ให้ตั้งฐานข้อมูลและ secret แยก หรือยังไม่ deploy backend Preview จนกว่าจะมีค่าของ Preview ครบ

## 3. สร้าง Vercel projects

Import repository เดียวกัน 5 ครั้ง เปิด **Include source files outside of the Root Directory in the Build Step** สำหรับ npm workspaces ตั้ง Node.js **22.x** และติดตั้ง development dependencies เพื่อใช้ Prisma CLI/TypeScript

ทุก project ตั้ง `installCommand` ใน `vercel.json` เป็น `npm ci --include=dev` เพื่อให้เครื่องมือ build ติดตั้งแม้มี `NODE_ENV=production` และแต่ละ workspace ระบุ TypeScript/Node types ของตัวเอง ไม่พึ่ง devDependencies ของ repository root หากพบ `tsc: command not found` ให้ตรวจว่า deployment ใช้ commit ที่มีการตั้งค่านี้แล้ว

| Project | Root Directory | Framework | Build command |
|---|---|---|---|
| Frontend | `frontend` | Vite | `npm run build` |
| Gateway | `gateway` | Express | `npm run build` |
| Auth | `services/auth-service` | Express | `npm run generate && npm run build` |
| Link | `services/link-service` | Express | `npm run generate && npm run build` |
| Analytics | `services/analytics-service` | Express | `npm run generate && npm run build` |

ใช้ production project domains ที่คงที่ เช่น YOUR-AUTH.vercel.app ไม่ใช้ URL ที่เปลี่ยนตาม commit จดทั้ง 5 URLs และตั้ง backend region ใกล้ Supabase ใน Functions Settings

## 4. Environment Variables

ตั้ง Production ของ **Gateway และ 3 services** ให้เหมือนกันในส่วนนี้:

```dotenv
NODE_ENV=production
APP_URL=https://YOUR-FRONTEND.vercel.app
INTERNAL_API_SECRET=RANDOM_SECRET_AT_LEAST_32_CHARACTERS
AUTH_SERVICE_URL=https://YOUR-AUTH.vercel.app
LINK_SERVICE_URL=https://YOUR-LINK.vercel.app
ANALYTICS_SERVICE_URL=https://YOUR-ANALYTICS.vercel.app
```

Auth/Link/Analytics เพิ่ม DATABASE_URL และ DIRECT_URL ของตัวเอง Gateway ไม่มีฐานข้อมูล Frontend ไม่มี secret ของ backend ไม่ตั้ง HOST/PORT เพื่อเปิด server บน Vercel เพราะ Vercel import default app จาก src/app.ts

ให้ **Production deployments เข้าถึงได้โดยไม่ติดหน้าล็อกอินของ Vercel Deployment Protection** มิฉะนั้นการเรียกข้าม services จะถูกดักก่อนถึง Express แม้ internal secret ถูกต้อง Routes ของ services ยังตรวจ x-internal-key ของเรา `/healthz` และ `/readyz` เปิดไว้ตรวจสถานะได้ อย่าให้ browser รู้ internal secret หลังแก้ env ต้อง redeploy backend ทั้ง 4 projects

## 5. ตั้ง frontend routes

จาก repository root ใช้ Gateway URL จริง:

```sh
npm run vercel:gateway -- https://YOUR-GATEWAY.vercel.app
```

คำสั่งแก้ frontend/vercel.json ให้ /api/* และ /s/* ไป Gateway หน้าอื่นไป index.html ค่า `configure-gateway.example` ที่เตรียมไว้ยังใช้งานจริงไม่ได้ Commit ค่าที่แก้แล้ว redeploy Frontend

Browser เรียก API บน frontend domain เดียวกัน cookie session จึงอยู่ frontend domain ไม่ต้องเพิ่ม CORS หรือเก็บ token ใน localStorage Short URL/QR ใช้ APP_URL ของ frontend จึงต้องตรงกับ URL ที่ส่งผู้ตรวจ

## 6. ทดสอบ URL จริง

1. สมัครสมาชิก/login แก้ชื่อใน /profile แล้ว refresh
2. สร้างลิงก์ https://www.synerry.com เปิด Short URL ในหน้าต่างใหม่ ต้องไปเว็บต้นฉบับ
3. ดาวน์โหลด QR แล้วสแกนบนมือถือผ่านอินเทอร์เน็ต
4. ประวัติและสถิติต้องเพิ่มคลิกเมื่อเปิด Short URL ด้วย GET
5. ทดสอบ alias ซ้ำ ลิงก์ปิด/หมดอายุ และบัญชีอื่นเข้าไม่ถึงข้อมูลเจ้าของเดิม
6. Gateway /healthz และ 3 services /readyz ต้องตอบ 200; เรียก API ของ service โดยไม่มี internal key ต้องได้ 403

Vercel ใช้ Functions ตามคำขอ มี cold start และไม่มี process ประจำสำหรับงานเบื้องหลัง จึงบันทึก click สำเร็จก่อนตอบ redirect Rate limit ของ Auth/Create ใช้ PostgreSQL ส่วน Gateway ใช้ memory ของแต่ละ instance ไม่ใช่โควตารวมทุก instance

แยก deploy service ได้ แต่ PostgreSQL instance เดียวเป็นจุดพึ่งพาร่วม ถ้าฐานข้อมูลล่มทุก service ที่ใช้ DB จะกระทบ และ Analytics ล่มทำให้ GET redirect ตอบ 503 ตามนโยบายเก็บคลิกให้ครบ ควรอธิบาย dependency นี้ในการ Video Call

## อ้างอิง

- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express)
- [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Prisma 6 on Vercel](https://www.prisma.io/docs/orm/v6/prisma-client/deployment/serverless/deploy-to-vercel)

ยังไม่ได้ตรวจ quota หรือสิทธิ์ของบัญชี hosting จริง ต้องดู dashboard ของบัญชีก่อนส่งงาน

Gateway reads x-vercel-forwarded-for only in Vercel runtime, validates the IP and strips it before forwarding. Through frontend rewrites the platform may identify a proxy IP; verify login rate limits with actual cloud traffic before increasing public usage.
