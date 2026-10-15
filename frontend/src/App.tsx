import { useState, useEffect } from "react";
import {
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import type { ReactNode } from "react";
import type { User } from "./types/api";
import { api, ApiError, errorText } from "./services/api";
import { Navigation, Workspace } from "./components/Navigation";
import { Home } from "./pages/Home";
import { AuthPage } from "./pages/AuthPage";
import { ProfilePage } from "./pages/ProfilePage";
import { Dashboard, HistoryPage } from "./pages/Dashboard";
import { LinkDetails } from "./pages/LinkDetails";
import { Analytics } from "./components/Analytics";
import { Feedback } from "./components/Feedback";

// main.tsx แสดง App ใน BrowserRouter → App เลือก Page และส่ง user/callback ลงไป; Page/Component เรียก api.ts เอง
export function App() {
  // State ส่วนกลาง: ข้อมูลบัญชี สถานะตรวจ Session ข้อผิดพลาด และสถานะ Logout
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  function handleLogin(user: User) { // รับผล Login หรือแก้โปรไฟล์ แล้วอัปเดตบัญชีใน UI
    setUser(user);
    setError("");
  }
  useEffect(() => { // หลัง React อัปเดต DOM: เรียก API ตรวจ Session เมื่อเริ่มแอป
    api<{ user: User }>("/api/auth/me") // api.ts → Gateway → Auth controller.me → getUserFromSession → { user } กลับมาที่ then
      .then((result) => setUser(result.user))
      .catch((error) => {
        setUser(null);
        if (!(error instanceof ApiError) || error.status !== 401) // 401 ถือว่ายังไม่ได้ Login; Error อื่นจึงแสดงข้อความ
          setError(errorText(error));
      })
      .finally(() => setLoading(false)); // ตรวจ Session จบทั้งกรณีสำเร็จ/ผิดพลาด ให้ Render ใหม่ด้วย loading=false
  }, []);

  useEffect(() => { // เมื่อเปลี่ยนหน้า/Hash หรือโหลดเสร็จ: เลื่อนขึ้นบนหรือไปฟอร์มสร้างลิงก์
    if (loading) return; // ยังตรวจ Session อยู่: หยุดรอบนี้; loading เปลี่ยนแล้ว Effect จึงทำงานอีก
    const frame = requestAnimationFrame(() => {
      if (location.hash === "#create") // มี #create ให้เลื่อนไปฟอร์มสร้างลิงก์
        document.getElementById("create")?.scrollIntoView();
      else window.scrollTo(0, 0); // URL อื่นให้เลื่อนขึ้นด้านบน
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash, loading]);
  async function logout() { // ส่ง API ยกเลิก Session; สำเร็จแล้วล้างบัญชีและกลับหน้าแรก
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      setError("");
      navigate("/");
    } catch (error) {
      setError(errorText(error)); // Logout ไม่สำเร็จ: แสดงข้อความและยังไม่ล้าง user
    } finally {
      setLoggingOut(false); // คืนสถานะปุ่มเสมอ เพื่อให้กดได้อีกหลัง Request จบ
    }
  }
  function protectedPage(content: ReactNode) { // รอตรวจ Session; ไม่มีบัญชีไป Login; มีบัญชีแสดงหน้าส่วนตัว
    if (loading) return <Feedback loading />; // รู้ผล Session ก่อน จึงยังไม่รีบส่งไปหน้า Login
    if (!user) return <Navigate to="/login" replace />; // ตรวจจบและไม่มีบัญชี: ไป Login โดยแทนรายการปัจจุบันใน History
    return content; // มีบัญชี: คืนเนื้อหาหน้าส่วนตัว; Backend ยังต้องตรวจสิทธิ์เอง
  }
  const content = ( // Routes เลือกหน้าที่ตรง URL และแสดงข้อความผิดพลาดส่วนกลาง
    <>
      {/* แสดง Error ส่วนกลางจากการตรวจ Session หรือ Logout; ไม่มีข้อความจะไม่แสดง */}
      <Feedback error={error} />
      <Routes>
        {/* หน้าแรก: ระหว่างตรวจ Session แสดงกำลังโหลด; ตรวจจบแล้วแสดง Home พร้อมข้อมูล user */}
        <Route
          path="/"
          element={loading ? <Feedback loading /> : <Home user={user} />}
        />

        {/* Login: AuthPage ส่ง API เอง แล้วเรียก handleLogin ผ่าน onLogin เมื่อสำเร็จ */}
        <Route
          path="/login"
          element={<AuthPage key="login" onLogin={handleLogin} />}
        />

        {/* สมัคร: register เปิดโหมดสมัคร; key ต่างจาก Login ทำให้สลับโหมดแล้วเริ่ม State ใหม่ */}
        <Route
          path="/register"
          element={<AuthPage key="register" register onLogin={handleLogin} />}
        />

        {/* Dashboard: มี user จึงส่งให้หน้าลูก; protectedPage จัดการสถานะโหลด/ไม่มีบัญชี */}
        <Route
          path="/dashboard"
          element={protectedPage(user ? <Dashboard user={user} /> : null)}
        />
        {/* ประวัติ: ต้องผ่าน protectedPage ก่อนแสดง HistoryPage */}
        <Route path="/history" element={protectedPage(<HistoryPage />)} />

        {/* โปรไฟล์: มี user จึงแสดงฟอร์ม; onUpdated อัปเดตบัญชีและชื่อบนเมนูหลังบันทึกสำเร็จ */}
        <Route
          path="/profile"
          element={protectedPage(
            user ? <ProfilePage user={user} onUpdated={handleLogin} /> : null,
          )}
        />

        {/* สถิติรวม: แสดงหัวข้อและ Analytics สำหรับสมาชิกที่ผ่าน protectedPage */}
        <Route
          path="/analytics"
          element={protectedPage(
            <>
              <div className="page-heading">
                <h1>สถิติการคลิก</h1>
                <p className="muted">เข้าใจการใช้งานลิงก์ของคุณจากข้อมูลจริง</p>
              </div>
              <Analytics />
            </>,
          )}
        />
        {/* รายละเอียด: :id รับรหัสจาก URL เช่น /links/abc123; LinkDetails ใช้รหัสนี้เรียก API */}
        <Route path="/links/:id" element={protectedPage(<LinkDetails />)} />

        {/* ไม่ตรง Route ใด: แสดงไม่พบหน้านี้พร้อมลิงก์กลับหน้าแรก */}
        <Route
          path="*"
          element={
            <div className="empty-state">
              <h1>ไม่พบหน้านี้</h1>
              <Link className="text-link" to="/">
                กลับหน้าหลัก
              </Link>
            </div>
          }
        />
      </Routes>
    </>
  );
  // มีบัญชีและอยู่หน้าจัดการ ให้ใช้ Layout ที่มี Sidebar
  const inWorkspace =
    Boolean(user) && // ต้องมีบัญชี และ Path ต้องตรงกลุ่มหน้าจัดการด้านล่าง
    /^\/(dashboard|history|analytics|links|profile)(\/|$)/.test(
      location.pathname,
    );
  const authPage =
    location.pathname === "/login" || location.pathname === "/register"; // อยู่หน้าใดหน้าหนึ่ง ใช้ CSS สำหรับหน้าบัญชี
  return ( // คืน JSX ให้ React สร้างหน้าจอ ก่อนทำ callback ของ useEffect
    <>
      <a href="#main" className="skip-link">
        ข้ามไปเนื้อหา
      </a>
      {/* เมนูรับ user เพื่อเลือกสิ่งที่แสดง; onLogout ให้เรียกเมื่อกดปุ่ม; busy ปิดปุ่มขณะ Logout */}
      <Navigation user={user} onLogout={logout} busy={loggingOut} />
      {/* เงื่อนไข ? ... : ... เลือก Layout: จริงใช้ Workspace/Sidebar; เท็จใช้ main ของหน้าแรกหรือหน้าบัญชี */}
      {inWorkspace ? (
        <Workspace>{content}</Workspace>
      ) : (
        <main id="main" className={authPage ? "auth-main" : "home-main"}>
          {content}
        </main>
      )}
    </>
  );
}
