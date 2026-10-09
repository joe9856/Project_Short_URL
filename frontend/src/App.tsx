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

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  function handleLogin(user: User) {
    setUser(user);
    setError("");
  }
  useEffect(() => {
    api<{ user: User }>("/api/auth/me")
      .then((result) => setUser(result.user))
      .catch((error) => {
        setUser(null);
        if (!(error instanceof ApiError) || error.status !== 401)
          setError(errorText(error));
      })
      .finally(() => setLoading(false));
  }, []);
  // เปลี่ยนหน้าแล้วกลับไปหัวข้อหลัก หรือเลื่อนไปฟอร์มสร้างลิงก์
  useEffect(() => {
    if (loading) return;
    const frame = requestAnimationFrame(() => {
      if (location.hash === "#create")
        document.getElementById("create")?.scrollIntoView();
      else window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash, loading]);
  async function logout() {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      setError("");
      navigate("/");
    } catch (error) {
      setError(errorText(error));
    } finally {
      setLoggingOut(false);
    }
  }
  function protectedPage(content: ReactNode) {
    if (loading) return <Feedback loading />;
    if (!user) return <Navigate to="/login" replace />;
    return content;
  }
  const content = (
    <>
      <Feedback error={error} />
      <Routes>
        <Route
          path="/"
          element={loading ? <Feedback loading /> : <Home user={user} />}
        />
        <Route
          path="/login"
          element={<AuthPage key="login" onLogin={handleLogin} />}
        />
        <Route
          path="/register"
          element={<AuthPage key="register" register onLogin={handleLogin} />}
        />
        <Route
          path="/dashboard"
          element={protectedPage(user ? <Dashboard user={user} /> : null)}
        />
        <Route path="/history" element={protectedPage(<HistoryPage />)} />
        <Route
          path="/profile"
          element={protectedPage(
            user ? <ProfilePage user={user} onUpdated={handleLogin} /> : null,
          )}
        />
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
        <Route path="/links/:id" element={protectedPage(<LinkDetails />)} />
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
  const inWorkspace =
    Boolean(user) &&
    /^\/(dashboard|history|analytics|links|profile)(\/|$)/.test(
      location.pathname,
    );
  const authPage =
    location.pathname === "/login" || location.pathname === "/register";
  return (
    <>
      <a href="#main" className="skip-link">
        ข้ามไปเนื้อหา
      </a>
      <Navigation user={user} onLogout={logout} busy={loggingOut} />
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
