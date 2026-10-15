import { Link2, QrCode, ChartNoAxesCombined } from "lucide-react";
import type { User } from "../types/api";
import { CreateForm } from "../components/CreateForm";
import { ShortUrlHero } from "../components/ShortUrlHero";
// App เลือก / และส่ง user → Home ส่ง authenticated ให้ CreateForm → CreateForm จัดการ API/ผลลิงก์เอง
export function Home({ user }: { user: User | null }) {
  return (
    <>
      <ShortUrlHero />
      {/* Boolean(user) เป็น true เมื่อมีผู้ใช้ ให้ CreateForm เปิดปุ่มสร้าง; Backend ตรวจสิทธิ์อีกชั้น */}
      <CreateForm authenticated={Boolean(user)} />
      {/* ข้อความแนะนำความสามารถเป็นเนื้อหาคงที่ ไม่ใช่ข้อมูลสถิติจากฐานข้อมูล */}
      <div className="home-features">
        <div>
          <Link2 size={22} aria-hidden="true" />
          <h2>ลิงก์สั้น พร้อมใช้</h2>
          <p>ตั้งชื่อเองและกำหนดวันหมดอายุได้</p>
        </div>
        <div>
          <QrCode size={22} aria-hidden="true" />
          <h2>QR สำหรับทุกลิงก์</h2>
          <p>ดาวน์โหลดได้ทั้ง PNG และ SVG</p>
        </div>
        <div>
          <ChartNoAxesCombined size={22} aria-hidden="true" />
          <h2>ติดตามการเปิด</h2>
          <p>ดูประวัติ คลิก และสถิติรายวัน</p>
        </div>
      </div>
    </>
  );
}
