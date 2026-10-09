import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  Link2,
  LayoutDashboard,
  History,
  Plus,
  LogOut,
  ChartNoAxesCombined,
  UserRound,
} from "lucide-react";
import type { User } from "../types/api";

export function Navigation({
  user,
  onLogout,
  busy,
}: {
  user: User | null;
  onLogout: () => void;
  busy: boolean;
}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="brand" aria-label="Short URL หน้าหลัก">
          <Link2 size={25} aria-hidden="true" />
          Short URL<span className="brand-dot">.</span>
        </Link>
        <nav className="header-nav" aria-label="เมนูหลัก">
          {user ? (
            <>
              <NavLink to="/dashboard" className="nav-link">
                <LayoutDashboard size={18} aria-hidden="true" />
                แดชบอร์ด
              </NavLink>
              <NavLink to="/history" className="nav-link">
                ประวัติ
              </NavLink>
              <NavLink to="/analytics" className="nav-link">
                สถิติ
              </NavLink>
              <NavLink
                to="/profile"
                className="nav-link account-link"
                aria-label="บัญชีของฉัน"
                title={user.name}
              >
                <UserRound size={18} aria-hidden="true" />
                <span className="account-name">{user.name}</span>
                <span className="account-label">บัญชี</span>
              </NavLink>
              <button
                className="btn btn-secondary"
                aria-label="ออกจากระบบ"
                onClick={onLogout}
                disabled={busy}
              >
                <LogOut size={17} aria-hidden="true" />
                {busy ? "กำลังออก…" : "ออกจากระบบ"}
              </button>
            </>
          ) : (
            <>
              <Link className="nav-link" to="/login">
                เข้าสู่ระบบ
              </Link>
              <Link className="btn btn-primary" to="/register">
                สมัครสมาชิก
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

// ใช้กรอบเดียวกันทุกหน้าจัดการ เพื่อให้เมนูและตำแหน่งเนื้อหาคงที่
export function Workspace({ children }: { children: ReactNode }) {
  return (
    <div className="workspace">
      <aside className="sidebar">
        <p className="eyebrow">พื้นที่ทำงาน</p>
        <nav aria-label="เมนูพื้นที่ทำงาน">
          <NavLink className="sidebar-item" to="/dashboard">
            <LayoutDashboard size={18} aria-hidden="true" />
            แดชบอร์ด
          </NavLink>
          <Link className="sidebar-item" to="/dashboard#create">
            <Plus size={18} aria-hidden="true" />
            สร้างลิงก์
          </Link>
          <NavLink className="sidebar-item" to="/history">
            <History size={18} aria-hidden="true" />
            ประวัติลิงก์
          </NavLink>
          <NavLink className="sidebar-item" to="/analytics">
            <ChartNoAxesCombined size={18} aria-hidden="true" />
            สถิติ
          </NavLink>
          <NavLink className="sidebar-item" to="/profile">
            <UserRound size={18} aria-hidden="true" />
            บัญชีของฉัน
          </NavLink>
        </nav>
        <p className="sidebar-note">
          ลิงก์ของคุณ
          <br />
          พร้อมแชร์ในที่เดียว
        </p>
      </aside>
      <main id="main" className="workspace-main">
        {children}
      </main>
    </div>
  );
}
