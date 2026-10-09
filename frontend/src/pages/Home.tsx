import { Link2, QrCode, ChartNoAxesCombined } from "lucide-react";
import type { User } from "../types/api";
import { CreateForm } from "../components/CreateForm";
import { ShortUrlHero } from "../components/ShortUrlHero";
export function Home({ user }: { user: User | null }) {
  return (
    <>
      <ShortUrlHero />
      <CreateForm authenticated={Boolean(user)} />
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
