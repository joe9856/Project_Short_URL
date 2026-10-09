import { useState, type FormEvent } from "react";
import { UserRound, Save } from "lucide-react";
import type { User } from "../types/api";
import { api, errorText } from "../services/api";
import { Feedback } from "../components/Feedback";

export function ProfilePage({
  user,
  onUpdated,
}: {
  user: User;
  onUpdated: (user: User) => void;
}) {
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("กรุณากรอกชื่อ");
      return;
    }
    setSaving(true);
    try {
      // ส่งเพียงชื่อ ส่วนบัญชีที่ต้องแก้ไขจะอ่านจาก session บน Auth Service
      const result = await api<{ user: User }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: trimmedName }),
      });
      setName(result.user.name);
      onUpdated(result.user);
      setSaved(true);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setSaving(false);
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
