import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Link2 } from "lucide-react";
import { api, errorText } from "../services/api";
import type { ShortLink } from "../types/api";
import { Feedback } from "./Feedback";
import { LinkResult } from "./LinkResult";
export function CreateForm({
  authenticated = true,
  onCreated,
}: {
  authenticated?: boolean;
  onCreated?: () => void;
}) {
  const [originalUrl, setOriginalUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [link, setLink] = useState<ShortLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const url = new URL(originalUrl);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error("กรุณาใช้ URL แบบ HTTP/HTTPS ที่ไม่มีรหัสผ่าน");
      // เปลี่ยนเวลาในช่องกรอกเป็น UTC ก่อนส่งให้ Backend
      const result = await api<{ link: ShortLink }>("/api/links", {
        method: "POST",
        body: JSON.stringify({
          originalUrl,
          ...(alias ? { alias } : {}),
          ...(expiresAt
            ? { expiresAt: new Date(expiresAt).toISOString() }
            : {}),
        }),
      });
      setLink(result.link);
      onCreated?.();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div id="create">
      <section className="panel generator-panel">
        <h2 className="section-heading">
          <Link2 size={22} aria-hidden="true" />
          สร้างลิงก์สั้น
        </h2>
        <form onSubmit={submit}>
          <label htmlFor="originalUrl">URL ปลายทาง</label>
          <div className="create-main-row">
            <input
              id="originalUrl"
              type="url"
              required
              maxLength={8192}
              value={originalUrl}
              onChange={(event) => setOriginalUrl(event.target.value)}
              placeholder="https://example.com/your-long-url"
              aria-describedby="url-help"
            />
            <button
              disabled={loading || !authenticated}
              className="btn btn-primary"
              type="submit"
            >
              {loading ? "กำลังสร้าง…" : "ย่อลิงก์"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
          <p id="url-help" className="muted text-sm mt-2">
            รองรับ HTTP และ HTTPS เก็บ query และ fragment ของลิงก์เดิม
          </p>
          <details className="advanced-options">
            <summary>ตั้งค่าชื่อลิงก์และวันหมดอายุ (ไม่บังคับ)</summary>
            <div className="form-grid">
              <div>
                <label htmlFor="alias">ชื่อที่กำหนดเอง</label>
                <input
                  id="alias"
                  value={alias}
                  onChange={(event) => setAlias(event.target.value)}
                  pattern="[A-Za-z0-9_-]{3,32}"
                  placeholder="my-campaign"
                  maxLength={32}
                />
                <p className="muted text-sm mt-2">
                  A–Z, a–z, 0–9, ขีดกลาง และขีดล่าง 3–32 ตัว
                </p>
              </div>
              <div>
                <label htmlFor="expires">วันหมดอายุ (เวลาท้องถิ่น)</label>
                <input
                  id="expires"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>
            </div>
          </details>
          {!authenticated && (
            <p className="guest-message">
              <Link className="text-link" to="/login">
                เข้าสู่ระบบ
              </Link>{" "}
              หรือ{" "}
              <Link className="text-link" to="/register">
                สมัครสมาชิก
              </Link>{" "}
              เพื่อสร้างลิงก์และเก็บประวัติส่วนตัว
            </p>
          )}
          <Feedback error={error} />
        </form>
      </section>
      {link && (
        <>
          <p className="success-text mb-3" role="status">
            สร้างลิงก์สำเร็จ พร้อมแชร์แล้ว
          </p>
          <LinkResult key={link.id} link={link} />
        </>
      )}
    </div>
  );
}
