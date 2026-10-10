# เอกสารสำหรับตรวจแบบทดสอบ Short URL

[เปิดเว็บทดสอบ](https://project-short-url-qrrz.vercel.app) · [Source Code](https://github.com/joe9856/Project_Short_URL) · [วิธีติดตั้งฉบับเต็ม](../README.md)

ผู้ตรวจสมัครบัญชีใหม่แล้วเข้าสู่ระบบเพื่อสร้างและจัดการลิงก์ได้ การเปิด Short URL และสแกน QR ไม่ต้องเข้าสู่ระบบ

## เริ่มตรวจงาน

| สิ่งที่ต้องการตรวจ | เอกสาร / แผนภาพ |
|---|---|
| ติดตั้งและรันในเครื่อง | [README หลัก](../README.md) และ [PostgreSQL ในเครื่อง](local-postgres.md) |
| สร้าง Short URL, Redirect, QR, ประวัติ และยอดคลิก | [วิธีทดสอบพร้อมผลลัพธ์ที่คาดหวัง](testing.md) |
| การออกแบบกระแสข้อมูล DFD Level 0 | [ภาพ DFD](diagrams/dfd-level-0-submission.png) และ [คำอธิบาย 5 กระบวนการ](dfd.md) |
| การออกแบบฐานข้อมูล ER Diagram | [ภาพ PNG](diagrams/er.png) · [ขยาย SVG](diagrams/er.svg) · [Source](diagrams/er.mmd) |
| Microservices Architecture | [ภาพ Architecture](diagrams/architecture-submission.png) และ [คำอธิบายระบบ](architecture.md) |
| API ที่ใช้จริง | [API Contract](api.md) |
| Deploy และตั้งค่าระบบออนไลน์ | [Vercel + Supabase](deployment.md) |

[เปิด Architecture และ DFD ใน Figma](https://www.figma.com/design/KWIrbon5NX18Yh3vvZBqPq/Short-URL-%E2%80%94-Microservices-architecture?node-id=0-1)

## ฟังก์ชันตามโจทย์

- กรอก URL แล้วสร้าง Short URL ที่เปิดไปยัง URL ต้นฉบับได้
- สร้าง QR Code ของ Short URL และสแกนเพื่อเปิดปลายทางได้
- แสดงประวัติ URL ต้นฉบับและ Short URL พร้อมสถิติการเปิดลิงก์

## ฟังก์ชันเพิ่มเติม

- สมัครสมาชิก เข้าสู่ระบบ ออกจากระบบ และแก้ไขชื่อบัญชี
- แยกข้อมูลและสิทธิ์การจัดการตามเจ้าของบัญชี
- กำหนด Alias ของลิงก์เอง ตั้งหรือแก้วันหมดอายุ และเปิด–ปิดลิงก์
- ค้นหา กรองสถานะ และแบ่งหน้าประวัติลิงก์
- ดูแดชบอร์ดและสถิติรายวัน อุปกรณ์ และแหล่งที่มาตามช่วงวันที่
- ดาวน์โหลด QR เป็น PNG หรือ SVG

ระบบพัฒนาด้วย React และ Node.js/Express เชื่อมต่อ PostgreSQL ผ่าน Prisma แยก Auth, Link และ Analytics เป็นบริการที่ deploy แยกกัน โดยรายละเอียดการทำงานอยู่ในเอกสาร Architecture
