import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api, errorText } from "../services/api";
import type { User } from "../types/api";
import { Feedback } from "../components/Feedback";
// App ใช้หน้าเดียวกันสำหรับ Login/Register; register เลือกโหมด และ onLogin ส่งผู้ใช้กลับไปอัปเดต App
export function AuthPage({
  register,
  onLogin,
}: {
  register?: boolean;
  onLogin: (user: User) => void;
}) {
  // State เก็บค่าฟอร์มและสถานะคำขอ; พิมพ์ข้อมูลยังไม่เรียก API
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  // Submit → สมัครสมาชิกถ้าจำเป็น → Login → อัปเดตผู้ใช้ใน App → เปลี่ยนหน้า Dashboard
  async function submit(event: FormEvent) {
    event.preventDefault(); // ไม่ให้เบราว์เซอร์ส่งฟอร์มแบบรีโหลดหน้า
    setError("");
    setLoading(true);
    try {
      // api.ts → Gateway → Auth controller.register → registerUser/Prisma → รอสร้างบัญชีแล้วจึง Login ต่อ
      if (register) // โหมดสมัครสมาชิกต้องรอสร้างบัญชีสำเร็จก่อน; ถ้าผิดพลาดจะไป catch ไม่ทำ Login ต่อ
        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });
      // POST → Auth controller.login → loginUser + createSession → { user } และ Cookie; result.user ส่งกลับ App ผ่าน onLogin
      const result = await api<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onLogin(result.user); // เรียก callback ที่ App ส่งมา เพื่อให้เมนูและหน้าส่วนตัวรู้ว่า Login แล้ว
      navigate("/dashboard"); // เปลี่ยน Frontend Route หลัง Login สำเร็จ
    } catch (error) {
      setError(errorText(error));
    } finally {
      setLoading(false); // finally ทำงานเมื่อจบทั้งกรณีสำเร็จและผิดพลาด เพื่อเปิดปุ่มอีกครั้ง
    }
  }
  return (
    <>
      <section className="panel auth-panel">
        <p className="eyebrow">
          <span className="accent-rule" />
          พื้นที่สำหรับลิงก์ของคุณ
        </p>
        <h1>{register ? "เริ่มต้นใช้งาน" : "ยินดีต้อนรับกลับ"}</h1>
        <p className="muted auth-description">
          {register
            ? "สร้างบัญชีเพื่อย่อลิงก์และติดตามสถิติ"
            : "เข้าสู่ระบบเพื่อจัดการลิงก์ของคุณ"}
        </p>
        {/* ช่อง value/onChange เชื่อมกับ State; register && แสดงช่องชื่อเฉพาะหน้าสมัครสมาชิก */}
        <form className="auth-form" onSubmit={submit}>
          {register && (
            <div>
              <label htmlFor="name">ชื่อ</label>
              <input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
              />
            </div>
          )}
          <div>
            <label htmlFor="email">อีเมล</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
            />
          </div>
          <div>
            <label htmlFor="password">รหัสผ่าน</label>
            <input
              id="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              aria-describedby="password-help"
            />
            <p className="muted text-sm mt-2" id="password-help">
              อย่างน้อย 8 ตัวอักษร
            </p>
          </div>
          <Feedback error={error} />
          <button className="btn btn-primary" disabled={loading}>
            {loading
              ? "กำลังดำเนินการ…"
              : register
                ? "สมัครสมาชิก"
                : "เข้าสู่ระบบ"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
        <p className="muted auth-switch">
          {register ? "มีบัญชีแล้ว? " : "ยังไม่มีบัญชี? "}
          <Link className="text-link" to={register ? "/login" : "/register"}>
            {register ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </Link>
        </p>
      </section>
    </>
  );
}
