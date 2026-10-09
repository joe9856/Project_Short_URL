# MySQL แบบ portable สำหรับ Windows

เมื่อ Docker engine ไม่พร้อม ใช้ ZIP official MySQL Community Server8.4.11 (ไม่ใช่MariaDBในXAMPP). ไม่ติดตั้งWindowsservice ไม่แตะMySQL/credentials/dataเดิม

1. ดาวน์โหลดZIPจาก https://dev.mysql.com/downloads/mysql/8.4.html และตรวจintegrityตามOracle; extractไว้ `.local/mysql-8.4.11-winx64`. ครั้งที่ทำงานนี้ตรวจMD5เทียบofficialpageก่อนextract
2. `npm run setup` ถ้ายังไม่มีenv. `npm run db:local` เปิด3processes,bind127.0.0.1:3311/3312/3313,สร้างfreshdatadirs `.local/db-auth`, `.local/db-links`, `.local/db-analytics`, rootpasswordและ3owneraccountsจากfreshenv. ห้ามรันคู่กับComposeDBportsเดียวกัน
3. เปิดterminalอื่น: `npm run generate`, `npm run migrate`, `npm run dev`. Ctrl+Cที่DBterminalเพื่อshutdown. ครั้งต่อไป `npm run db:local` ใช้persisteddatadirsเดิม
4. `npm run test:integration` migrate*\_testแยกและล้างเฉพาะtestDB. developmentdataยังอยู่. ถ้าprocessไม่readyอ่าน `.local/*-mysql.log` ไม่เผยpassword

`.local/` และ `.env` ถูกgitignore. ต้องมีVisualC++runtimeตามMySQLrequirements. ตัวscriptจำกัดWindowsportable;Linuxใช้ComposeหรือmanagedMySQLและenvper-service. เมื่อต้องย้ายprojectpathควรstopDBprocessesก่อนย้ายdatadirsแล้วrestartจากโฟลเดอร์ใหม่

ปิด DB อย่างสุภาพจากอีก terminal ได้ด้วย `node scripts/stop-local-mysql.mjs` (ใช้ root ของ DB ใหม่จาก `.env` เท่านั้น)

MySQL runtime ตั้ง `--default-time-zone=+00:00` เพื่อให้ DB defaults เป็น UTC; service ส่ง createdAt เป็น Date UTC โดยตรงด้วย
