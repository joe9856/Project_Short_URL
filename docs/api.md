# API Contract v1

Browser ใช้ Gateway เท่านั้น; body JSON <=32 KiB; protected APIs ใช้ HttpOnly `short_session` Cookie. POST/PATCH public ต้องมี Origin ตรง APP_URL ข้อมูลที่ผิด schema ตอบ 400 และไม่อนุญาต fields เพิ่ม

| Method / path            | Input                                                                     | Output / status                                                           |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| POST /api/auth/register  | name 1–80, email <=254, password 8–128                                    | 201 `{user:{id,name,email}}` ไม่มี session; login ต่อ                     |
| POST /api/auth/login     | email,password                                                            | 200 `{user}` + Set-Cookie                                                 |
| POST /api/auth/logout    | none                                                                      | 204 + clear cookie; delete session                                        |
| PATCH /api/auth/me       | `{name}` 1–80 ตัวอักษร หลัง trim; session + Origin                        | 200 `{user}` แก้ชื่อเฉพาะเจ้าของ session; 400/401/403                     |
| GET /api/auth/me         | cookie                                                                    | 200 `{user}` หรือ 401                                                     |
| POST /api/links          | originalUrl <=8192, alias? 3–32 `[A-Za-z0-9_-]`, expiresAt? ISO offset    | 201 `{link}`; alias ชน 409                                                |
| GET /api/links           | page 1+, pageSize 1–100, search <=200, status all/active/disabled/expired | 200 `{links,pagination:{page,pageSize,total,pages}}` แต่ละ link มี clicks |
| GET /api/links/:id       | UUID                                                                      | 200 `{link}` owner only                                                   |
| PATCH /api/links/:id     | isActive?:boolean, expiresAt?:ISO or null, ต้องมีอย่างน้อย 1 field        | 200 `{link}`; expiry ใหม่ต้องอยู่อนาคต                                    |
| GET /api/links/:id/qr    | format png/svg; download=1 สำหรับ attachment                              | 200 image/png หรือ image/svg+xml; owner only                              |
| GET /api/links/:id/stats | from?,to? YYYY-MM-DD                                                      | 200 `{stats}`; Auth + Link ownership                                      |
| GET /api/stats           | from?,to? YYYY-MM-DD                                                      | 200 `{stats}` owner summary                                               |
| GET /s/:code             | code                                                                      | 302 Location หลัง Analytics persist; 404/410/503                          |
| HEAD /s/:code            | code                                                                      | 302 without click event                                                   |
| GET /healthz             | none                                                                      | 200 `{status:"ok"}` shallow                                               |

Link: id,userId,code,originalUrl,shortUrl,isActive,expiresAt,createdAt,updatedAt,status. Code case-sensitive จาก UNIQUE collation ใน migration. URL scheme เฉพาะ HTTP/HTTPS ไม่มี username/password รักษา query/fragment โดยไม่ fetch ปลายทาง

Stats: totalLinks,activeLinks,totalClicks,clicksByDate:[{date,clicks}],devices:[{name,clicks}],sources:[{name,clicks}],range:{from,to,timezone}. Summary counts links ทั้งหมด/current active; click counts จำกัดช่วงวันที่. Default ย้อนหลัง 30 วันรวมวันนี้. ช่วงวันที่ใช้ [00:00 Bangkok ของ from,00:00 Bangkok ของวันหลัง to); daily zero-filled; top 20 sources; clicks รวม bots และซ้ำ ไม่ใช่ unique people

## Private REST

ทุก API ของ service ต้องมี `X-Internal-Key` เท่ากับ INTERNAL_API_SECRET และควรอยู่ private network. GET health/readiness เปิดเพื่อ probes; internal paths ไม่ถูก proxy ผ่าน Gateway

| Service / path                          | Body                                                                                                 | Output                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Auth POST /internal/sessions/verify     | `{}` + Cookie                                                                                        | 200 `{user}`, 401 invalid/expired, 503 DB down                   |
| Link POST /internal/links/:id/ownership | `{userId:UUID}`                                                                                      | 200 `{owned:true}` หรือ 404 สำหรับไม่พบ/ไม่ใช่ owner             |
| Link POST /internal/links/summary       | `{userId:UUID}`                                                                                      | 200 `{totalLinks,activeLinks}`                                   |
| Analytics POST /internal/visits         | eventId/linkId/ownerId UUID, clickedAt ISO UTC, deviceType desktop/mobile/tablet, referrerHost <=253 | 201 `{recorded:true}` หลัง commit รวม replay; 409 event mismatch |
| Analytics POST /internal/click-counts   | `{ownerId:UUID,linkIds:UUID[]}` max100                                                               | 200 `{counts:{[linkId]:number}}` missing key =0                  |

Timeout 2.5 seconds, internal non-success -> dependency error; visit retry 3 attempts UUID เดิม. Gateway timeout upstream10s/request12s. หาก response สูญหายหลัง insert ผู้ใช้เห็น503แต่ event อาจอยู่แล้ว; counts นับ persisted click requests ไม่ยืนยันว่าปลายทางโหลดสำเร็จ

Error envelope `{error:{code,message,fields?}}`. Status 400 validation/JSON,401 auth,403 origin/internal access,404 not found/owner,409 collision/conflict,410 link unavailable,413 body limit,429 rate,503 controlled dependency/database failure. ไม่ส่ง SQL/stack/secret. X-Request-Id ส่งข้ามบริการเพื่อ correlation ไม่มี token/full IP ใน logs

Limits: Register10/15min ต่อ IP, Login30/15min ต่อ IP, Create100/hour ต่อ verified user (DB atomic); Gateway600/minute สำหรับหนึ่ง replica. Retry-After เมื่อ limit. รักษา reverse proxy/IP limitation ตาม README
