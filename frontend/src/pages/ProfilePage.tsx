import { useState, type FormEvent } from "react";
import { UserRound, Save } from "lucide-react";
import type { User } from "../types/api";
import { api, errorText } from "../services/api";
import { Feedback } from "../components/Feedback";

// App ส่ง user ปัจจุบันมาให้แก้ชื่อ และรับผลกลับผ่าน onUpdated เพื่ออัปเดตเมนู/แดชบอร์ด
export function ProfilePage({
  user,
  onUpdated,
}: {
  user: User;
  onUpdated: (user: User) => void;
}) {
  const [name, setName] = useState(user.name); // ใช้ชื่อจาก Props เป็นค่าเริ่มต้นของ State ในฟอร์ม
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // ส่งฟอร์มแล้วจึงบันทึกชื่อผ่าน PATCH /api/auth/me
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    const trimmedName = name.trim(); // ตัดช่องว่างหัวท้ายก่อนตรวจและส่งข้อมูล
    if (!trimmedName) { // ไม่มีชื่อให้หยุดก่อนเรียก API
      setError("กรุณากรอกชื่อ");
      return;
    }
    setSaving(true);
    try {
      // api.ts → Gateway → Auth controller.updateProfile → updateUserName/Prisma → { user } กลับมา; เจ้าของอ่านจาก Session
      const result = await api<{ user: User }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: trimmedName }),
      });
      setName(result.user.name);
      onUpdated(result.user); // ส่งข้อมูลที่ Backend ยืนยันแล้วกลับไปให้ App อัปเดต user
      setSaved(true);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setSaving(false); // จบสถานะบันทึกทั้งกรณีสำเร็จและผิดพลาด
    }
  }

  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">
          <span className="accent-rule" />
          ข้อมูลบัญชี
        </p>
        <h1>บัญชีของฉัน</h1>
        <p className="muted">จัดการชื่อที่แสดงในพื้นที่ทำงานของคุณ</p>
      </div>
      <section className="panel profile-panel">
        <h2 className="section-heading">
          <UserRound size={22} aria-hidden="true" />
          แก้ไขชื่อของคุณ
        </h2>
        <dl className="profile-info">
          <dt>อีเมลบัญชี</dt>
          <dd className="selectable-text">{user.email}</dd>
        </dl>
        {/* พิมพ์ชื่อเปลี่ยนเฉพาะ State และล้างข้อความเก่า; กดบันทึกจึงเรียก save */}
        <form className="profile-form" onSubmit={save} aria-busy={saving}>
          <div>
            <label htmlFor="profile-name">ชื่อของคุณ</label>
            <input
              id="profile-name"
              autoComplete="name"
              value={name}
              required
              maxLength={80}
              disabled={saving}
              aria-describedby="profile-name-help"
              onChange={(event) => {
                setName(event.target.value);
                setSaved(false);
                setError("");
              }}
            />
            <p id="profile-name-help" className="muted text-sm mt-2">
              ใช้ได้สูงสุด 80 ตัวอักษร ชื่อใหม่จะแสดงในเมนูและแดชบอร์ด
            </p>
          </div>
          <Feedback error={error} />
          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              <Save size={17} aria-hidden="true" />
              {saving ? "กำลังบันทึก…" : "บันทึกชื่อ"}
            </button>
          </div>
          {/* แสดงข้อความนี้เมื่อ API บันทึกสำเร็จเท่านั้น */}
          {saved && (
            <p role="status" className="success-text">
              บันทึกชื่อเรียบร้อยแล้ว
            </p>
          )}
        </form>
      </section>
    </>
  );
}
