# คู่มืออ่านโค้ดสำหรับ Junior Full-Stack Developer

## เริ่มจาก flow ที่สั้นที่สุด

1. `frontend/src/components/CreateForm.tsx`: useState เก็บ originalUrl/alias/expiresAt, onChange เปลี่ยนค่าตามที่พิมพ์, onSubmit เรียก submit. preventDefault ไม่ให้ form reload ทั้งหน้า. loading ทำให้ปุ่ม disabled; try/catch เก็บ error; finally คืน loading=false
2. `frontend/src/services/api.ts`: Fetch ส่ง JSON, credentials same-origin ทำให้ browser แนบ HttpOnly cookie โดย JavaScript ไม่อ่าน token. await รอ HTTP ไม่ใช่ await ให้DBของ frontend ทำงาน. response.ok ตรวจ status; JSON response เปลี่ยนเป็น object
3. `gateway/src/app.ts` และ `routes/proxy.ts`: เลือก service ตาม path ส่ง body/cookie/query/header ที่อนุญาต. ไม่ Query DB. `middlewares/guards.ts` ตรวจ Origin, ลบ spoofed identity/forwarding, verify cookie กับ Auth
4. `services/link-service/src/routes/index.ts`: Express Router เลือก method/path แล้วเรียก middleware/controller. `req.body` คือ JSON input, `req.params.id` คือค่าใน path, `req.query` คือคำค้น/หน้า
5. `controllers/links.ts` ฟังก์ชัน create: validate Zod, ใช้ user จาก res.locals ที่ middlewareตรวจจากAuth แล้วเรียก createLink. Controller ดูแล HTTP input/output ไม่ปะปน DB logic
6. `services/links.ts` ฟังก์ชัน createLink: ตรวจเงื่อนไขธุรกิจ สุ่ม code หรือ alias ใช้ loop retry เมื่อ UNIQUE ชน. `prisma.link.create` ส่ง INSERT ลง Links DB. await ให้ operationจบก่อนส่ง201
7. `prisma/schema.prisma`: model Link บอก field/type/index. Prisma generated client ของ Link ใช้เฉพาะ schema นี้. migration.sql สร้างตารางจริงในPostgreSQL
8. Response `{link}` กลับ Gateway → api helper → React setLink. React render LinkResult โดยอัตโนมัติเมื่อ stateเปลี่ยน; QR ใช้ protected image path ของ Gateway

## ติดตามแต่ละฟีเจอร์จากไฟล์จริง

| Feature / frontend             | HTTP/Gateway                                         | Controller → Service → Prisma/Table                                                                                        | Result และการล้มเหลว                         |
| ------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| AuthPage.tsx สมัคร             | POST /api/auth/register → Auth                       | controllers/auth.register → services/auth.registerUser → user.create / users                                               | 201 user;409 email;400 validate;429 rate     |
| AuthPage.tsx เข้าระบบ          | POST /api/auth/login → Auth                          | login → loginUser/createSession → user.findUnique/session.create / users,sessions                                          | 200 user+cookie;401 credentials;503 DB       |
| App.tsx logout/me              | POST logout,GET me → Auth                            | logout/me → logoutSession/getUserFromSession → session.deleteMany/findUnique / sessions                                    | 204 revoke;401 expired                       |
| CreateForm.tsx                 | POST /api/links → Link                               | controllers/links.create → createLink → link.create / links                                                                | 201 link;409 alias;503 retry exhausted       |
| History.tsx                    | GET /api/links?search&page&status → Link             | list → listLinks → link.findMany/count; HTTP click-counts → Analytics.clickCounts → clickEvent.groupBy                     | 200 links+pagination+clicks;503 Analytics    |
| LinkDetails.tsx ข้อมูล/ตั้งค่า | GET/PATCH /api/links/:id → Link                      | detail/update → ownedLink/updateLink → link.findFirst/update / links                                                       | 200;404 for non-owner;400 expiry             |
| LinkResult.tsx QR              | GET /api/links/:id/qr → Link                         | qr → ownedLink/generateQr → link.findFirst แล้ว qrcode                                                                     | PNG/SVG Short URL;404 owner;ไม่นับclick      |
| Browser เปิดshortURL           | GET /s/:code → Link                                  | redirect → redirectDestination → link.findUnique; HTTP internal/visits → Analytics.visit → recordClick → clickEvent.create | 302 after persist;404/410/503;HEAD no event  |
| Analytics.tsx                  | GET /api/stats หรือ /api/links/:id/stats → Analytics | stats → statistics → clickEvent.count/groupBy/$queryRaw; HTTP Link.summary/ownership                                       | 200 stats;404 owner;400 range;503 dependency |

ไฟล์ controller/service ในตารางอยู่ใต้ `services/<ชื่อ>-service/src/controllers/<ชื่อ>.ts` และ `src/services/<ชื่อ>.ts`: Authใช้auth.ts, Linkใช้links.ts, Analyticsใช้analytics.ts. ฟังก์ชันdateRange/bangkokDayใน analytics/src/lib/dates.ts จัดช่วง [start,end) และเติมวันที่คลิกศูนย์

## ทำไมต้อง Microservices

แยก ownership/process/deploy เป็นจริง แต่เพิ่ม network/latency/operational cost. Modular Monolith แยกโมดูลภายใน processเดียวและเรียกfunctionกันได้; งานนี้ข้ามบริการต้องHTTPและล้มเหลวแยกได้. DB ownership ป้องกัน couplingผ่าน SQLjoin/FK ทำให้ migrate แต่ละบริการได้ แต่จะ transactionทุกDBพร้อมกันง่าย ๆ ไม่ได้

## Authentication ข้าม Service

Cookie→Auth sessions tokenHash→userIdที่ตรวจแล้ว→Link query `{id,userId}`. Auth unavailableต้องปฏิเสธ protected API. ห้ามเชื่อ userId จาก body/X-User-Id. private endpointsใช้secret+network; shared secretคือสิทธิ์ของบริการจึงห้ามส่งให้Reactหรือlog. productioncookieSecureต้องHTTPS

## ทำไม Click ต้อง Idempotent

INSERTอาจสำเร็จแต่ responseหาย. Retryสร้างeventIdใหม่จะนับ2. Linkสร้างUUIDหนึ่งครั้งแล้วretryIDเดิม; AnalyticsUNIQUEและตรวจpayload. ส่ง302เฉพาะยืนยันrecorded:true. ถ้าไม่ได้ackคืน503; eventอาจถูกcommitแล้วจึงห้ามอ้างexactly-once. HEAD/QRไม่ใช่GETเปิดshortURLจึงไม่เรียกrecordClick

## JS/TS ที่พบ

constเก็บค่าที่ไม่assignใหม่; letใช้loop/stateชั่วคราว; interfaceอธิบายshape ไม่validate runtime; Zodvalidate inputจริง. mapเปลี่ยนlistเป็นUI/DTO, findค้นกลุ่มวันที่, forวนretry/เติมzero dates. async/awaitทำให้ flowเหมือนอ่านขั้นตอน; try/catchจัดerror; throwส่งต่อExpress5 errorHandler. fetchเป็นข้ามnetwork ส่วนPrismaเป็นownedDB. HttpErrorเป็นclassเล็กสำหรับstatus/codeไม่ใช่frameworkหรือDI

## Error และ Tests

อ่าน tests/auth.test.ts, links.test.ts, analytics.test.ts ในแต่ละservice: unit/Supertestใช้Prisma mocksเพื่อควบคุมedgecase. `gateway/tests/gateway.test.ts` เปิดfakeHTTPdownstreamจริงทดสอบproxy. `scripts/integration.mjs` ไม่mockDB: migrate/l้าง\*\_test, เปิด4processes, ทดสอบ20concurrentcreates/redirects, retry/ownership/outages/restart. `tests/e2e/system.spec.ts` เปิดbrowserสร้างบัญชี/ลิงก์/QR/redirect/stats/disable/logout 3viewports

## คำถามสัมภาษณ์ตามฟีเจอร์

| Feature      | คำถามที่ควรอธิบายได้                                                                    |
| ------------ | --------------------------------------------------------------------------------------- |
| React/Create | useStateเปลี่ยนแล้วเกิดอะไร? ทำไมvalidateที่frontendอย่างเดียวไม่พอ?                    |
| Auth         | ทำไมpasswordใช้Argon2idแต่sessiontokenใช้SHA256? logoutrevokeต่างจากลบcookieอย่างไร?    |
| Gateway      | ทำไมstatsต้องmatchก่อนlinks? ทำไมไม่เชื่อX-User-Id?                                     |
| Links        | UNIQUEต่างจากเช็กก่อนinsertอย่างไร? concurrentaliasชนแล้วคืน409อย่างไร?                 |
| Redirect     | ถ้าAnalyticsdownจะตอบอะไร? HEADนับclickหรือไม่? UUIDเดิมแก้retryอย่างไร?                |
| QR           | QRencodeอะไร? quietzoneคืออะไร? downloadทำไมไม่เพิ่มclick?                              |
| History      | ทำไมใช้batchcounts? ทำไมไม่joinDBข้ามservice?                                           |
| Analytics    | UTCกับBangkokต่างอย่างไรที่เที่ยงคืน? ownerfilterและLinkownershipมีบทบาทต่างกันอย่างไร? |
| Deploy       | แยกprocessทำให้scaleอัตโนมัติหรือไม่? synchronousHTTPtrade-offอะไร?                     |

Demo30นาที: architecture5, create5, redirect/count5, QR/history/stats5, auth/security5, tests/limitations5. เริ่มอธิบายโค้ดจากReactจริงจนPostgreSQLและย้อนresponseกลับ ไม่อ้างว่างานนี้productiondeployแล้ว
