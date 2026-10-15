import { useState } from "react";
import { CreateForm } from "../components/CreateForm";
import { History } from "../components/History";
import { Analytics } from "../components/Analytics";
import { ShortUrlHero } from "../components/ShortUrlHero";
import type { User } from "../types/api";
// App ส่ง user → ประกอบ CreateForm/Analytics/History; ลูกเรียก API ของตนเอง และ callback กลับมาเปลี่ยน refresh ที่นี่
export function Dashboard({ user }: { user: User }) {
  const [refresh, setRefresh] = useState(0); // ตัวนับกระตุ้น Effect ของลูกให้ดึงข้อมูลใหม่ ไม่ใช่รีโหลดทั้งเว็บ
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">
          <span className="accent-rule" />
          ภาพรวมของคุณ
        </p>
        <h1>แดชบอร์ด</h1>
        <p className="muted">
          สวัสดี {user.name} · จัดการลิงก์และติดตามผลได้ในที่เดียว
        </p>
      </div>
      <ShortUrlHero headingLevel="h2" />
      {/* CreateForm สร้างสำเร็จ → onCreated เพิ่ม refresh → Analytics/History เรียก API ใหม่ */}
      <CreateForm authenticated onCreated={() => setRefresh(refresh + 1)} />
      <Analytics refresh={refresh} showSummary />
      {/* History แก้สถานะสำเร็จ → onUpdated เพิ่ม refresh จากค่าล่าสุด ให้ทั้งประวัติและสถิติทันสมัย */}
      <History
        refresh={refresh}
        onUpdated={() => setRefresh((value) => value + 1)}
      />
    </>
  );
}
// App เลือกหน้านี้สำหรับ /history; ใช้ History เดิมดูแล API/ค้นหา/แบ่งหน้า ส่วน Workspace อยู่ใน App
export function HistoryPage() {
  return (
    <>
      <div className="page-heading">
        <h1>ประวัติลิงก์</h1>
        <p className="muted">ค้นหาและจัดการลิงก์ทั้งหมดของคุณ</p>
      </div>
      <History />
    </>
  );
}
