import { useState } from "react";
import { CreateForm } from "../components/CreateForm";
import { History } from "../components/History";
import { Analytics } from "../components/Analytics";
import type { User } from "../types/api";
export function Dashboard({ user }: { user: User }) {
  const [refresh, setRefresh] = useState(0);
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
      <CreateForm authenticated onCreated={() => setRefresh(refresh + 1)} />
      <Analytics refresh={refresh} showSummary />
      <History refresh={refresh} />
    </>
  );
}
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
