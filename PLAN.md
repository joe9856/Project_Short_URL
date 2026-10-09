> Current hosting decision: Frontend + Gateway + Auth/Link/Analytics on Vercel; PostgreSQL on Supabase with app_auth/app_links/app_analytics schemas. See docs/deployment.md and docs/postgres-changes.md. The MySQL/container choices below are the original planning history.

# PLAN — Short URL Management System (React + Node.js / Express Microservices)

> **เอกสารแผนฉบับใหม่ แยกจาก React + Express Modular Monolith**  
> ดัดแปลงโดยยึดขอบเขตฟังก์ชัน, UI/UX, API, ความปลอดภัย, การทดสอบ และแนวทาง Beginner-Friendly จาก `PLAN-REACT-NODE.md` ซึ่งเป็นแผนสำหรับ `D:\Projects\short-url-react-node`  
> **เป้าหมายโฟลเดอร์โปรเจกต์ใหม่:** `D:\Projects\short-url-microservices`  
> **ห้ามแก้ / ลบ / เขียนทับ** `D:\Projects\short-url-demo` และ `D:\Projects\short-url-react-node` รวมถึง Git, `.env`, ฐานข้อมูล และ Production ของสองโปรเจกต์นั้น  
> **สถานะ:** เป็นเอกสารออกแบบ ยังไม่ได้สร้างหรือรัน Microservices Project  
> **หมายเหตุ:** คำว่า Microservices หมายถึงแต่ละ Backend Service รัน/Deploy แยกกัน มี API, ขอบเขตความรับผิดชอบและข้อมูลของตัวเอง ไม่ใช่แค่แยกโฟลเดอร์

## 1. วัตถุประสงค์และ Technology Stack

สร้าง Short URL เวอร์ชัน Microservices แบบ **เพื่อการเรียนรู้และเปรียบเทียบ** โดยรักษาพฤติกรรมของโจทย์เดิมให้ครบ ไม่เพิ่มความซับซ้อนโดยไม่จำเป็น ผู้พัฒนาต้องอ่านและอธิบายโค้ดได้เอง

| ส่วน | เทคโนโลยีและกติกา |
|---|---|
| Frontend | React + Vite + TypeScript (TSX), React Router, Tailwind CSS |
| Backend | Node.js + Express.js + TypeScript (แบบพื้นฐาน), REST API |
| Gateway | Express + `http-proxy-middleware` (ทำ HTTP routing/proxy ไม่ทำ Business Logic) |
| Services | Auth Service, Link Service, Analytics Service = **3 แอปแยก Process** |
| Database | MySQL development; **3 logical databases**: `short_auth`, `short_links`, `short_analytics`, บน MySQL server เดียวใน Local ได้ |
| ORM | Prisma ORM สำหรับแต่ละ Service แยก schema/migrations/client; ตรวจ versions ที่รองรับก่อนติดตั้ง |
| Auth | Argon2id, Session token แบบ opaque ใน HttpOnly Cookie, ตรวจ Session ผ่าน Auth API ภายใน |
| QR / Charts | `qrcode` PNG/SVG, Recharts |
| Tests | Vitest, Supertest, Playwright, MySQL Integration |
| Local infrastructure | Docker Compose สำหรับ MySQL และแอปหลาย Process; `npm workspaces` สำหรับสั่งรัน/ทดสอบ |
| Source | GitHub **Repository ใหม่ 1 Repo** แบบ Monorepo; ไม่แยกเป็นหลาย Git Repos เพื่อให้เรียนง่าย |
| Production | React static frontend + Gateway public + 3 private backend processes; เลือกผู้ให้บริการที่รองรับ persistent Node services ก่อน Deploy |

**เงื่อนไขโจทย์บริษัท:** ก่อนใช้เวอร์ชันนี้ส่งงาน ต้องตรวจว่าผู้ตรวจยอมรับ React + Node.js ร่วมกัน และอนุญาต Microservices หรือไม่ เพราะโจทย์เดิมใช้คำว่า “อย่างใดอย่างหนึ่ง” และอาจต้องใช้ MySQL จริง ไม่ใช่ TiDB แม้ TiDB จะรองรับ MySQL protocol ก็ตาม

## 2. Architecture และ Data Flow

### 2.1 ภาพรวมที่ต้องสร้างจริง

```text
Browser / React (Vite SPA :5173)
            |
            | fetch('/api/...') / GET '/s/:code'
            v
      API Gateway (:3000)       <-- public entry (local/prod)
            |
            +---- /api/auth/* ------------> Auth Service (:3001)
            |                               + users, sessions  [short_auth DB]
            |
            +---- /api/links/* -----------> Link Service (:3002)
            |      /s/:code                 + links [short_links DB]
            |                               + generates QR + handles redirect
            |
            +---- /api/stats -------------> Analytics Service (:3003)
                   /api/links/:id/stats    + click_events [short_analytics DB]

Private internal REST calls (not exposed to Internet):
  Link / Analytics -> Auth: verify session, get userId
  Analytics -> Link: verify link belongs to userId (for per-link stats)
  Link -> Analytics: POST visit event (learning baseline: synchronous)
```

- **Gateway ไม่ใช่ Service ธุรกิจ**: ทำ Reverse Proxy, จำกัดขนาดคำขอ, เบื้องต้นเรื่อง Origin/rate limit/headers; ห้ามใส่ Prisma หรือ Logic สร้างลิงก์ที่ Gateway
- **แต่ละ Service รันได้อย่างอิสระ** มี `app.ts`, `server.ts`, `routes/`, `controllers/`, `services/`, `prisma/` และชุด Test ของตัวเอง
- **แต่ละ Service เข้าถึงได้เฉพาะฐานข้อมูลของตน** ห้ามใช้ Prisma ของ Service อื่นหรือ Query ตารางข้ามฐานข้อมูลโดยตรง
- **ห้ามเรียกฟังก์ชันข้าม Service ผ่าน import** ให้เรียก HTTP API ที่ระบุใน Contract เท่านั้น
- ใน Local ให้ Gateway เป็น public entry; Auth/Link/Analytics bind private/internal addresses ใน Compose เมื่อ deploy จริง และป้องกัน internal endpoints ด้วย network isolation + internal secret (คอนฟิกที่เชื่อถือได้)

### 2.2 การสร้าง Short URL (เหมือนระบบเดิม)

1. React `useState` เก็บ Original URL; กด Submit -> `fetch('/api/links', {method:'POST', ...})`.
2. Gateway ส่งไป Link Service ไม่แก้ Business Data.
3. Link Service ใช้ Cookie ที่มากับคำขอ ไปขอตรวจจาก Auth Service ผ่าน private API; Auth เช็ก `sessions` ใน `short_auth` และคืน userId ที่เชื่อถือได้; ถ้าตรวจไม่ได้ให้ **fail closed** (ไม่ถือว่า Login แล้ว)
4. Controller ใช้ Zod validate; Service สุ่ม 8 ตัวด้วย `crypto.randomInt()` หรือรับ Alias; Prisma `link.create()` ใน `short_links`; UNIQUE constraint + retry ป้องกัน Code ชน
5. Link Service ตอบ `{link}` (201) -> Gateway -> React `setLink(result.link)` แสดง Short URL/QR

### 2.3 Public Redirect และ Click Tracking (จุดสำคัญที่สุด)

1. Browser `GET /s/:code` -> Gateway -> Link Service **ไม่ผ่าน React Router** และไม่ต้อง Login.
2. Link Service `findUnique({where:{code}})` ใน `short_links`; ตรวจ URL/status/expiration (404/410).
3. รุ่นเรียนรู้เริ่มต้น: Link Service สร้าง `eventId` ที่ไม่ซ้ำ แล้ว `POST /internal/visits` ไป Analytics Service ผ่าน private REST; Analytics Service insert ลง `short_analytics.click_events` โดยมี `eventId UNIQUE`; ตอบผลสำเร็จ
4. เมื่อบันทึก Click Event สำเร็จแล้ว Link Service ส่ง `302 Location: <originalUrl>` พร้อม `Cache-Control: no-store` ให้ Browser
5. `HEAD /s/:code` ทำงานเหมือนค้น/ตรวจลิงก์ แต่ **ไม่** สร้าง Click Event
6. หาก Analytics Service/DB ไม่พร้อมใน baseline ที่รักษาการนับคลิกอย่างเคร่งครัด ให้ตอบ **503** และห้ามส่ง 302 แบบหลอกว่าบันทึกแล้ว; ระบุว่าเป็น **trade-off** ของ synchronous call ซึ่งทำให้ redirect พึ่งพา Analytics (ยังไม่เหมาะกับระบบปริมาณสูง)
7. ห้ามใช้ `fetch()` หลังตอบ 302 แบบ fire-and-forget เพราะอาจสูญเสีย Event เมื่อ Process หยุด

**Phase เสริมหลัง baseline ทำงาน:** ย้ายมาใช้ *Transactional Outbox + Worker + Message Broker/Queue* เพื่อให้ Link Service สร้าง Outbox Event ใน **transaction เดียวกับข้อมูลของ Link Service** แล้วส่ง 302 หลัง Commit ส่วน Worker ส่ง event ไป Analytics โดยมี Retry และ `eventId UNIQUE` กันนับซ้ำ; Dashboard อาจแสดงยอดช้าลงเล็กน้อย (*eventual consistency*). ห้ามเริ่มต้นด้วย Kafka/RabbitMQ ก่อนเข้าใจ HTTP flow และการแยกบริการจริง ๆ

### 2.4 QR / History / Analytics / Auth

- QR: React -> Gateway -> Link Service -> ตรวจ Session + Ownership -> `qrcode` encode **Short URL**, ไม่ใช้ Original URL -> PNG/SVG; ดาวน์โหลดไม่เพิ่ม Click
- History: React -> Gateway -> Link Service -> `findMany({where:{userId}})`; จำนวนคลิกของลิงก์ให้ Link Service ขอ Count แบบ batch จาก Analytics API; **ห้าม Query ข้าม DB** และหลีกเลี่ยง N+1 requests
- Analytics: React -> Gateway -> Analytics Service -> ตรวจ Session ที่ Auth Service, กรอง `ownerId`, `linkId`, ช่วงวันที่ -> count/group; link-specific stats ต้องตรวจ Ownership กับ Link Service อีกครั้งก่อนส่งผล
- Auth: Register/Login/Logout/Me -> Auth Service; Session ใน `short_auth`; Cookie ส่งผ่าน Gateway แบบ Same-Origin; ไม่เก็บ Token ใน LocalStorage
- Cross-service authorization: ข้อมูล userId จาก Frontend, query parameter, หรือ public header ไม่น่าเชื่อถือ; ให้แต่ละ Service ตรวจ session ของผู้ใช้กับ Auth Service และใช้ shared/internal-secret + private network เพื่อป้องกันการเรียก `/internal/*` จากภายนอก

### 2.5 Gateway Routing Contract

| Public path | Target service |
|---|---|
| `/api/auth/*` | Auth |
| `/api/links/:id/stats` | Analytics **ต้อง match ก่อน** `/api/links/*` |
| `/api/stats` | Analytics |
| `/api/links/*` | Link |
| `/s/*` | Link (Redirect; bypass SPA fallback) |
| `/healthz` | Gateway shallow health; แต่ละ Service มี `/healthz` แยก |

ให้เขียน Test กรณี Gateway routing ลำดับผิด, header forwarding, cookies, path/query และ error 502/503 อย่างชัดเจน ห้ามเปิด internal URL ผ่าน Gateway

## 3. Folder Structure — โฟลเดอร์ใหม่เท่านั้น

```text
short-url-microservices/
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── pages/             # Home/Login/Register/Dashboard/LinkDetails
│       ├── components/        # CreateForm/LinkResult/History/Analytics
│       ├── services/api.ts    # fetch helper ใช้ API paths เหมือนเดิม
│       ├── types/api.ts
│       └── styles/global.css
├── gateway/
│   ├── src/app.ts
│   ├── src/server.ts
│   ├── src/routes/proxy.ts     # route map -> service URLs
│   ├── src/middlewares/       # request guards + error mapping
│   └── package.json
├── services/
│   ├── auth-service/
│   │   ├── src/{app.ts,server.ts,routes/,controllers/,services/,middlewares/,lib/}
│   │   ├── prisma/schema.prisma
│   │   └── package.json
│   ├── link-service/
│   │   ├── src/{app.ts,server.ts,routes/,controllers/,services/,middlewares/,lib/}
│   │   ├── prisma/schema.prisma
│   │   └── package.json
│   └── analytics-service/
│       ├── src/{app.ts,server.ts,routes/,controllers/,services/,middlewares/,lib/}
│       ├── prisma/schema.prisma
│       └── package.json
├── shared/
│   └── contracts/             # เฉพาะ types/schema DTO ไม่ import Business Logic/Prisma Client ข้าม Service
├── tests/e2e/
├── docs/
│   ├── api.md
│   ├── architecture.md
│   ├── learning-and-interview.md
│   ├── comparison.md
│   └── diagrams/            # DFD L0, ER, architecture + service boundaries
├── compose.yaml
├── .env.example
├── .gitignore
├── package.json            # root npm workspaces
├── README.md
└── PLAN.md
```

ไม่ต้องสร้าง Packages หรือ Patterns ที่ไม่จำเป็น แม้มีหลาย Services ให้ใช้ฟังก์ชันธรรมดาและโครงสร้างเดียวกันทั้งหมด เพื่อให้เปิดตาม flow ได้โดยไม่งง

## 4. Beginner-Friendly JavaScript / React / TypeScript / Express

**กฎบังคับกับทุก Service:**

- JavaScript: `const`, `let`, `if/else`, `for`, `function`, arrays/objects, `map/filter/find`, `async/await`, `try/catch`, `import/export`, `fetch`
- React: Functional Components, Props, `useState`, `useEffect`, `onChange`, `onSubmit`, Conditional Rendering, `map()`; ใช้ React Router; ไม่ใช้ Redux/Zustand โดยไม่จำเป็น
- TypeScript: `string/number/boolean`, `interface`, `type`, optional fields, basic union/generic เท่าที่ต้องใช้ เปิด strict mode และ **ไม่ใช้ `any` เพื่อหนี Type Error**
- Express: ให้ตามลำดับได้ชัดเจน `Router -> Controller -> Service -> Prisma -> DB` และ `Service -> fetch(internal API)` เมื่อข้าม Service
- ใช้ `fetch` แบบธรรมดาสำหรับ internal HTTP calls; ห่อ Helper สั้น ๆ สำหรับ timeout/status/errors ได้ แต่ห้ามทำ SDK/abstract network layer ซับซ้อนตั้งแต่ต้น
- ห้ามสร้าง Class Controller, Dependency Injection, Repository Pattern ซ้ำ Prisma, CQRS/Event Sourcing เต็มรูปแบบ, Kubernetes, Service Mesh, gRPC, Kafka ตั้งแต่ baseline
- เขียนชื่อฟังก์ชันชัด เช่น `createLink`, `findLinkByCode`, `recordClick`, `getUserFromSession`; แยกหนึ่งฟังก์ชันต่อหน้าที่และใส่คอมเมนต์ภาษาไทยเฉพาะ Business Logic สำคัญ
- ความง่ายของ Syntax **ห้ามแลกกับการลดความปลอดภัย**: ใช้ Libraries สำหรับ password hash, session, URL validation, HTTP headers/Origin; ไม่คิดอัลกอริทึม Crypto เอง
- หลัง implement ทุก flow ต้องมีภาพและคำอธิบาย: *Browser ส่งอะไร? Gateway ส่งไปไหน? Service ไหนเป็นเจ้าของข้อมูล? Database ไหนตอบกลับ? HTTP status อะไร?*

### ตัวอย่างโค้ดที่ AI ควรยึดแนวทาง (ตัวอย่างอธิบาย ไม่ใช่ Implement ทั้งหมด)

```ts
// Link Controller: รับ HTTP แล้วส่งต่อให้ Service ไม่ Query ข้อมูลยาวเอง
export async function create(req: Request, res: Response) {
  const user = await getUserFromSession(req.headers.cookie);
  const input = createLinkSchema.parse(req.body);
  const link = await createLink(user.id, input);
  res.status(201).json({ link });
}

// Link Service: Business Logic แล้วเรียก Prisma ของตัวเอง
export async function createLink(userId: string, input: CreateLinkInput) {
  const code = generateCode();
  return prisma.link.create({ data: { userId, code, originalUrl: input.originalUrl } });
}
```

ตัวอย่างย่อด้านบนยังไม่แสดง collision retry / secure internal authentication / expiresAt/error handling ซึ่ง **ต้องมีในการ Implement จริง**

## 5. Functional Requirements — คง scope จากแผนเดิม

### 5.1 Core Requirements (ต้องผ่านก่อน)

1. รับ Original URL HTTP/HTTPS (max 8192) ไม่รับ scheme อื่น ไม่ฝัง credential และรักษา query/fragment
2. สุ่ม Short Code ปลอดภัย 8 ตัวด้วย `crypto.randomInt`, unique + retry; Alias ไม่ซ้ำ
3. `GET /s/:code` Redirect HTTP 302 ตามกฎ 404/410/503, `Cache-Control: no-store`
4. QR Code ของ **Short URL**, Preview + Download PNG/SVG และสแกนมือถือได้
5. ประวัติ Short URL แสดง Original URL, Short URL, วันที่สร้าง, สถานะและจำนวนคลิก
6. Click Event จริงทุก GET ที่ผ่านเงื่อนไข; HEAD/QR ไม่เพิ่ม Event; รวมการเปิดซ้ำและบอต (ไม่เรียก unique visitors)
7. Dashboard ภาษาไทย, Responsive 390/768/1440px, Loading/Empty/Error/Success

### 5.2 Additional Requirements (คงไว้ทั้งหมด)

1. Register/Login/Logout/Session; Owner-only links, QR, settings, stats
2. Custom Alias, Expiration, Enable/Disable, PATCH settings
3. Search/Filter/Pagination, Link Details, Copy Short URL
4. Analytics: total links, active links, total clicks, click by day (Asia/Bangkok), sources hostname, devices
5. Rate limits, secure cookies, Origin/CSRF controls, error handling, health checks
6. GitHub Repo ใหม่, README, API Docs, DFD L0, ER diagram, Architecture diagram, Testing/Deployment evidence

**อย่าตัด Feature เดิมเพียงเพื่อให้ Microservices ดูง่าย**; แยกการทำงานทีละ Phase และรายงานสิ่งที่ยังทำไม่ครบ

## 6. Database Ownership / ER Design

แบ่งข้อมูลจาก 5 ตารางตรรกะของระบบเดิม แต่ **ไม่เอาตารางทุกอย่างไปไว้ฐานข้อมูลเดียวกัน**:

| Service | Database | Tables / ตัวอย่าง Fields | หลักการ |
|---|---|---|---|
| Auth | `short_auth` | `users(id,email,password_hash,...)`, `sessions(token_hash,user_id,expires_at,...)`, `rate_limits` สำหรับ Auth | FK `sessions.user_id -> users.id` ภายใน DB เดียวกัน |
| Link | `short_links` | `links(id,user_id,original_url,code UNIQUE,is_active,expires_at,created_at)`, `rate_limits` สำหรับ Create | เก็บ `user_id` เป็นค่าอ้างอิงเท่านั้น **ไม่มี FK ข้าม Auth DB** |
| Analytics | `short_analytics` | `click_events(id,event_id UNIQUE,link_id,owner_id,clicked_at,referrer_host,device_type)` | **ไม่มี FK ข้าม Link DB**; ownerId ใช้กรองข้อมูลผู้ใช้ และ `event_id` กัน event ซ้ำ |

- แต่ละ Service มี Prisma schema, migrations, client, DB URL และ DB credential เฉพาะของตัวเอง
- DB server เดียวได้ใน local แต่ Database/Login Credential ต้องแยก Scope; ห้ามเชื่อมตารางข้าม Service ด้วย SQL JOIN
- Index: Links (`code` unique, `user_id+created_at`), Click Events (`event_id` unique, `link_id+clicked_at`, `owner_id+clicked_at`), Auth (email unique, session expiry)
- เก็บ timestamp เป็น UTC; dashboard ใช้ Asia/Bangkok (+07:00) และ end-exclusive date range
- ความสัมพันธ์ user->link, link->click event เป็น **logical relationship** ผ่าน ID/API/Event ไม่ใช่ FK ข้ามฐานข้อมูล
- Outbox/Queue Phase เสริม: เพิ่มตาราง `link_outbox_events` ใน Link DB และ Worker ตามความจำเป็น ไม่เพิ่มตั้งแต่ Day 1
- ไม่มีการแชร์ Prisma Client, DB user หรือ migrations ข้าม Service; ทดสอบ Migration แยกกันและห้ามแตะ DB ของสองโปรเจกต์ก่อนหน้า

## 7. Security / Reliability / Failure Handling

1. **Authentication:** Argon2id, opaque token ผ่าน HttpOnly Secure SameSite=Lax Cookie; `sessions.token_hash` ใน Auth DB; Logout ลบ Session; Auth Service ให้ internal verify API สำหรับ Service อื่นที่ต้องใช้ Owner Identity
2. **Service-to-service:** ใช้ private network + `INTERNAL_API_SECRET` (เทียบแบบปลอดภัย/ตาม library) ต่อ endpoint ที่จำเป็น; ห้าม expose `internal` endpoints ผ่าน Gateway; reject requests ไม่มีสิทธิ์; อย่า trust `X-User-Id` จาก Browser
3. **Authorization:** Link Service เช็ก Owner ในฐานข้อมูลตัวเอง; Analytics เช็ก Auth แล้วเช็ก link ownership ผ่าน internal Link API สำหรับ Link-specific stats; deny by default เมื่อ dependency ไม่ตอบ
4. **Rate limiting:** DB-backed สำหรับ Register/Login/Create (Auth/Link service) หรือ Redis ภายหลังหากจำเป็น; ทดสอบ concurrent requests; ไม่ใช้ counter ใน RAM สำหรับระบบหลาย replicas
5. **Redirect:** Public GET /s/:code สั้นที่สุด; 302 + no-store; invalid/unknown 404, disabled/expired 410, DB/Analytics unavailable (baseline) 503; HEAD ไม่เพิ่ม event; header Location สร้างจาก URL ที่ validate แล้ว
6. **Click event:** `eventId` unique, repeat requests มี event ใหม่, ไม่ใช้ `read -> increment -> update` ใน counter เดียว; POST internal event ให้ idempotent ต่อ eventId; timeout/retry ต้องออกแบบไม่ให้นับซ้ำ
7. **HTTP:** Validate ทั้ง React และ Server (เชื่อ Server เท่านั้น), Zod, Body size limit, Origin checks, error responses ไม่เผย SQL/stack/secrets, HTTPS/TLS, Content Security Headers ที่เหมาะสม
8. **Secrets:** `.env.example` เป็น placeholder เท่านั้น; ห้าม Commit `.env`, MySQL credentials, Cookie keys; ค่า `VITE_*` ถือว่า Public
9. **Fault tolerance:** Auth unavailable => protected APIs fail closed, public redirect ยังตรวจได้ (ถ้า Link/Analytics พร้อม); Analytics unavailable => baseline Redirect 503 แม้ Link ยังอยู่; บันทึก limitation ชัดและเพิ่ม Outbox Phase เสริมถ้าต้องการ resilience
10. **Data correctness:** ยอมรับ Eventual Consistency ใน Queue Version; idempotency + retry + DLQ (ถ้าใช้ broker), ไม่อ้าง exactly-once แบบไม่มีหลักฐาน

## 8. Public API และ Internal Contracts

**ห้ามเปลี่ยน Public API จากแผน React + Express ถ้าไม่จำเป็น** เพื่อเปรียบเทียบ Frontend ได้ยุติธรรม

| Method | Public API | Target |
|---|---|---|
| POST | `/api/auth/register` | Auth |
| POST | `/api/auth/login` | Auth |
| POST | `/api/auth/logout` | Auth |
| GET | `/api/auth/me` | Auth |
| POST | `/api/links` | Link |
| GET | `/api/links` | Link (history incl. clicks fetched in batch) |
| GET | `/api/links/:id` | Link |
| PATCH | `/api/links/:id` | Link |
| GET | `/api/links/:id/qr?format=png|svg` | Link |
| GET | `/api/links/:id/stats` | Analytics |
| GET | `/api/stats` | Analytics |
| GET | `/s/:code` | Link (302) |
| HEAD | `/s/:code` | Link (no click) |
| GET | `/healthz` | Gateway |

**ตัวอย่าง Private APIs (ใช้ HTTP เท่านั้นและ Auth ด้วย Internal Secret):**

- Auth: `POST /internal/sessions/verify` รับ Cookie/Session Token ที่ส่งในช่องทาง internal ที่อนุญาต ตอบ `{user:{id,name,email}}` หรือ 401; อย่า log token
- Link: `POST /internal/links/:id/ownership` รับ authenticated `userId` จาก trusted service, คืน boolean/404; ถ้า link ไม่มี/ไม่ใช่ owner ต้องไม่เผยข้อมูล
- Analytics: `POST /internal/visits` รับ `{eventId,linkId,ownerId,clickedAt,referrerHost,deviceType}` บันทึก Idempotent; `POST /internal/click-counts` รับ list of linkIds + verified ownerId เพื่อให้ Link History ขอ Count แบบ batch
- ทุก private endpoint: กำหนด Timeout, Error Contract, Validation, Auth, Tests และมี API docs; **ไม่ได้เปิดให้ Browser เรียกโดยตรง**
- Public JSON: `{link}`, `{links,pagination}`, `{error:{code,message,fields?}}` และ status 200/201/204/400/401/403/404/409/410/429/503; Gateway proxy error ให้มาตรฐานเดียวกัน
- การ verify session จาก service อื่นต้องไม่อาศัย userId ที่ผู้ใช้ส่งมาเอง; Gateway ไม่ควร inject identity header ที่ client spoof ได้

## 9. UI/UX — รักษาแผน Synerry-Inspired เดิม

**ไม่ต้องออกแบบหน้าเว็บใหม่**: ใช้ React Components/Routes, คำภาษาไทย, responsive และโทนขาว-เทา-แดงจากแผน React+Express เดิม เพื่อเปรียบเทียบ Architecture มากกว่า UI

| Token | Color | Use |
|---|---|---|
| Primary | `#C92720` | Primary CTA |
| Primary hover | `#A61F19` | Hover |
| Accent | `#EC2C23` | Small accent |
| Text | `#202124` | Text / heading |
| Muted | `#4B5563` | Secondary text |
| Background | `#F6F7F9` | Page |
| Surface | `#FFFFFF` | Cards |
| Border | `#E5E7EB` | Panel borders |

ใช้ Noto Sans Thai (Thai UI), Poppins บาง Heading, 16px body, visible focus, WCAG AA contrast, touch target >=44px, card radius 12px

Pages: Home + Create URL/QR; Login/Register; Dashboard + History + Summary + Analytics; Link Details + Disable/Expiry/QR/Stats. Mobile 390px, Tablet 768px, Desktop 1440px; loading/error/empty/success ครบ, URL ยาวไม่ล้น, รองรับ Keyboard. ไม่ใช้ Logo/Assets ที่เป็นทรัพย์สินของ Synerry จริง

React `fetch('/api/...')` และ `useState/useEffect` เหมือนเดิมทั้งหมด; แก้ Gateway ไม่ให้ frontend รู้ URL ของ Auth/Link/Analytics services โดยตรง

## 10. Testing Strategy — ต้องพิสูจน์ว่าแยก Service จริง

- **Unit:** URL validation, code generation, alias collision behavior, expiry, status, Thai dates, idempotency decisions, internal request validation
- **Per Service Supertest:** Routes/Controllers/errors/auth; test ด้วย fake downstream responses และ Prisma mocks แบบเหมาะสม
- **MySQL Integration:** migration แยก 3 DB, service DB permissions, code UNIQUE collision (20 concurrent create), owner-only, session revoke, events 20 simultaneous GET, `eventId UNIQUE`
- **Gateway Integration:** proxy mapping `/api/auth`, `/api/links`, `/api/links/:id/stats`, `/api/stats`, `/s`; Cookie/Location/headers/query preserved; internal paths unreachable; backend down -> 502/503
- **E2E Playwright:** Register -> Login -> Create -> QR PNG/SVG -> Open Short URL -> Count +1 -> History/Charts -> Disable/Expiry -> Logout; 390/768/1440px
- **Inter-service resilience:** Auth down denies protected requests; Analytics down baseline returns 503 (no 302); retry duplicate eventId count remains 1; HEAD/QR no event; verify secure `internal` access
- **Optional Queue Phase:** crash/restart outbox, delayed/replayed/out-of-order event, worker retries, duplicate delivery, backlog, eventual analytics, DLQ/recovery
- **Contract tests:** JSON schemas & status codes consistent; frontend and Link/Analytics inter-service contracts versioned clearly
- **CI:** typecheck, ESLint, unit/integration when DB available, builds for Frontend, Gateway and **all 3 Services**, tests actually run; report pass/fail/skip/blocked with timestamp
- **Production smoke:** public frontend -> gateway -> each service, redirects/QR/mobile, HTTPS cookies, secrets not exposed, stale SPAs, failure/recovery and /healthz readiness

## 11. Local Setup / Deploy / Environment

**Development Ports**: React :5173 -> Gateway :3000 -> Auth :3001 / Link :3002 / Analytics :3003; MySQL container :3306 or mapped local port to avoid clashes

**Local steps**:
1. ตรวจ working directory = **ใหม่** `D:\Projects\short-url-microservices`; ห้าม build/migrate โปรเจกต์เดิม
2. Initialize npm workspaces; สร้าง React SPA, Gateway, Express 3 Services พร้อม health checks
3. `docker compose up -d` เพื่อเริ่ม MySQL (และ services ถ้ามี config) หรือใช้ MySQL ติดตั้งในเครื่อง; **ใช้ฐานข้อมูลใหม่ 3 DB**
4. สร้าง schema/migration Prisma ของแต่ละ Service แยกกัน; ตรวจ/seed ของตัวเอง
5. ตั้ง `.env` แยก Service ตาม `.env.example` (ไม่มี secret จริงใน Git)
6. Run Frontend/Gateway/Auth/Link/Analytics พร้อมกัน, ตรวจ Ports และ Gateway Proxy
7. ทดสอบ flow Core end-to-end, service outages, cookies และ DB ownership

**ตัวอย่าง env placeholders (ห้ามใส่ Credential จริงในไฟล์ตัวอย่าง):**

```env
# Gateway
PUBLIC_APP_URL=http://localhost:5173
AUTH_SERVICE_URL=http://localhost:3001
LINK_SERVICE_URL=http://localhost:3002
ANALYTICS_SERVICE_URL=http://localhost:3003

# Private services (แต่ละบริการมี DATABASE_URL เฉพาะของตัวเอง)
DATABASE_URL=mysql://<user>:<password>@localhost:3306/<service_database>
INTERNAL_API_SECRET=<generate-strong-secret-per-environment>
APP_URL=http://localhost:5173
```

**Production architecture:** Frontend Static (Vercel หรือ Static Host) + HTTPS Gateway (public) + Node long-running Services (private container/process hosting เช่น Railway/Render/Fly.io/VPS ตามความสามารถและราคาในวันที่ทำจริง) + Managed MySQL DBs. ใช้ Reverse Proxy/Ingress ใน Host ให้ frontend/gateway มี origin เดียวกันเพื่อใช้ Cookie ง่าย; ต้อง Verify rewrites, `Set-Cookie`, Redirect, security และ browser tests จริงก่อนอ้างว่า deploy สำเร็จ

- **ไม่บังคับ Vercel 4 Services**: ระบบ background worker / internal networking / long-lived HTTP เหมาะกับ container hosting ที่รองรับจริงมากกว่า; อย่าอ้างว่า Free Tier รองรับเสมอ
- แยก .env, credentials, DB/migrations, Deploy Project, Log ของแต่ละ Service
- Health endpoint ของแต่ละ Service แยก; service discovery ผ่าน env URLs ก่อน ไม่ใช้ Consul/Kubernetes
- Logging มี requestId/correlationId แบบเรียบง่าย ส่งต่อระหว่าง Gateway และ Services; ไม่ log tokens/secrets/full IP
- README ระบุคำสั่ง Run/Build/Test ของแต่ละ app, Database setup, architecture/ER/DFD, API docs, diagrams, ข้อจำกัด microservices และวิธี Demo

## 12. Development Roadmap — เรียนจากง่ายไปยาก ไม่บังคับ 3 วัน

| Phase | งานที่ทำ | Acceptance / สิ่งที่ต้องเข้าใจ |
|---|---|---|
| 0. Preparation | อ่าน PLAN/Source เดิม, สร้าง Repo ใหม่, workspace, env; **ห้ามแก้โปรเจกต์เดิม** | อธิบายความต่าง Monolith กับ Microservices ได้ |
| 1. Split app shells | React เดิมเป็นแนวทาง, Gateway, Auth/Link/Analytics Express **รันแยก** พร้อม /healthz | แต่ละ Service มี Process และ Port จริง; Gateway route ถูก |
| 2. Auth | MySQL short_auth, Prisma, Register/Login/Logout/Me, Session Verify Internal API | อธิบาย Cookie -> Session -> userId ได้ |
| 3. Link + QR | MySQL short_links, Code/URL, Ownership, QR, POST/GET/PATCH | อธิบาย React -> Gateway -> Link -> Auth -> Prisma ได้ |
| 4. Redirect + Click | MySQL short_analytics, Internal visit API, eventId unique, Redirect GET/HEAD | อธิบาย Link -> Analytics HTTP -> DB -> HTTP302 ได้ |
| 5. History + Stats | batch click counts, Analytics API, daily timezone, device/source and charts | ไม่มี Cross-DB join, ไม่มี N+1 request, owner checks ครบ |
| 6. Quality | Rate limit, Security, concurrency, outages, E2E/CI, README/diagrams | ทุก Service test ผ่าน; Negative cases และ Service outage test ได้ |
| 7. Optional | Transactional Outbox + Worker + Queue, resilient redirect | ทดสอบ delivery at least once + idempotency + eventual consistency |
| 8. Deployment | จัด Host/Proxy/HTTPS/secrets/DB และทดสอบ production | URL online จริง, Cookie, redirects, API และ logs ทำงานครบ |

**อย่ากระโดดไป Phase 7 เพียงเพราะชื่อ Microservices** — 3 Services ที่รันแยก + Internal REST + DB Ownership คือ Microservices แบบเริ่มต้นที่ทดสอบได้แล้ว

## 13. Deliverables และเกณฑ์เปรียบเทียบ

- Repo โครงการใหม่: React/Vite + Gateway + 3 Express Services ที่รันแยก + 3 MySQL DB + migrations ที่เป็นอิสระ
- README ภาษาไทย, `.env.example`, API Contracts (Public/Internal), DFD Level 0, ER ต่อ Service, Architecture Diagram, Sequence Diagrams สำหรับ Create/Redirect/Login/Stats
- Unit/Supertest/MySQL/Playwright + Contract/Failure Tests พร้อมหลักฐานรันจริง
- UI/Features เทียบเท่า `short-url-react-node` และ `short-url-demo`
- คู่มือเรียนแต่ละ Service อธิบาย `req.params`, `req.body`, `fetch`, `await`, `if/else`, `Prisma`, JSON, headers, HTTP status แบบผู้เริ่มเรียน
- ตารางเปรียบเทียบ 3 ระบบ **Next.js full-stack vs React+Express Monolith vs React+Express Microservices**: โครงสร้าง, ความง่ายในการอ่าน, API path, การ Deploy, จำนวน Processes/DB, การทดสอบ, ความทนทาน, ค่าใช้จ่าย, การอธิบายสัมภาษณ์
- อย่าอ้างว่า Microservices มีความเร็ว/ความปลอดภัยดีกว่าโดยอัตโนมัติ; ต้องวัดผลจริง
- Demo ภายใน 30 นาที: อธิบาย Architecture 5 นาที, Create 5, Redirect/Count 5, QR/History/Stats 5, Auth/Security 5, ผลทดสอบและข้อจำกัด 5

**AI ต้องอธิบายหลัง Implement แต่ละฟังก์ชัน:** ไฟล์และหน้าที่ → API input/output → flow ข้าม Service → query DB ของ Service ใด → แนวคิด JS/React ที่ใช้ → Error/Failure & Test → คำถามสัมภาษณ์ 2-3 ข้อ

## 14. ข้อกำหนดเริ่มพัฒนา / Safety / Scope

1. นี่เป็น **PLAN ใหม่** สำหรับ `D:\Projects\short-url-microservices`; ต้อง Copy ไฟล์นี้เป็น `PLAN.md` ของ Project ใหม่ **หลังได้รับคำสั่งให้เริ่มสร้างแอป** เท่านั้น
2. ห้ามแก้ `D:\Projects\short-url-react-node` หรือ `D:\Projects\short-url-demo`; ห้าม Copy `.env`, Git history/remote, Production Credentials หรือเชื่อมต่อ DB เดิมเพื่อเขียนข้อมูล
3. ใช้โค้ด/Architecture/Business Rules เดิมเป็น **reference แบบ read-only** เพื่อรักษาฟังก์ชัน/UI แต่สร้าง Source ของ Microservices ใน Project ใหม่
4. เมื่อได้รับคำสั่ง Implement: ตรวจ `pwd`, Files, project boundaries และ git status ก่อน; ทำ Phase 0 -> 6 ต่อเนื่องโดยทดสอบจริง; Phase 7 เป็น Optional ต้องให้ผู้ใช้เลือกก่อน เพราะซับซ้อนเกินพื้นฐาน
5. ถ้ายังไม่มี MySQL, Environment, Permission, Repo หรือ Hosting ให้สร้าง `.env.example`/Setup Docs และรายงานสิ่งที่รอ ไม่เดาผลทดสอบ ไม่ใช้งาน Secret เดิม
6. ห้าม Commit, Push, Deploy, เปลี่ยน DB Production หรือแก้โครงการต้นทาง เว้นแต่ผู้ใช้สั่งชัดเจน
7. หากมีข้อขัดแย้งระหว่างความง่ายของโค้ดกับความถูกต้อง ให้รักษาความปลอดภัยและข้อมูลก่อน แล้วเพิ่มคำอธิบายให้เข้าใจง่ายขึ้น

**End goal:** ระบบ Short URL แบบ **Microservices จริง** ที่แต่ละ Express Service รัน/Deploy/เป็นเจ้าของ Database แยกกัน, Public API และ UI เหมือนโปรเจกต์ก่อนหน้า, เขียนด้วย React/Node/Prisma ที่ผู้เรียน Junior Full-Stack สามารถไล่เส้นทาง `React -> Gateway -> Route -> Controller -> Service -> (Internal HTTP / Prisma) -> Database` และอธิบายได้ด้วยตัวเอง

---

### บันทึกการเปลี่ยนแปลงจากแผน `PLAN-REACT-NODE.md`

**คงเดิม:** Core/Additional Features, React/Vite/TS, Express, Prisma/MySQL, Auth/session/security requirements, QR PNG/SVG, Analytics + Thai timezone, Theme, responsive breakpoints, Testing/Docs, Beginner-Friendly coding style

**ปรับเพื่อ Microservices:** Backend เดียวเป็น Gateway + 3 Services (4 independent backend processes); DB เดียวเป็น 3 logical DBs; ownership ผ่าน internal APIs แทน cross-DB FK; click event via internal HTTP baseline + optional outbox/queue; Gateway routing; service-to-service auth; contract/failure tests; container deployment consideration; longer staged development plan
