import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Settings2 } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import type { ShortLink } from "../types/api";
import { api, errorText, thaiDate } from "../services/api";
import { LinkResult } from "../components/LinkResult";
import { Analytics } from "../components/Analytics";
import { Feedback } from "../components/Feedback";
export function LinkDetails() {
  const { id } = useParams();
  const [link, setLink] = useState<ShortLink | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [expiry, setExpiry] = useState("");
  const [active, setActive] = useState(true);
  const [success, setSuccess] = useState("");
  useEffect(() => {
    let current = true;
    api<{ link: ShortLink }>("/api/links/" + id)
      .then((result) => {
        if (current) {
          setLink(result.link);
          setActive(result.link.isActive);
          if (result.link.expiresAt) {
            const date = new Date(result.link.expiresAt);
            setExpiry(
              new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16),
            );
          }
        }
      })
      .catch((error) => {
        if (current) setError(errorText(error));
      });
    return () => {
      current = false;
    };
  }, [id]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await api<{ link: ShortLink }>("/api/links/" + id, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: active,
          expiresAt: expiry ? new Date(expiry).toISOString() : null,
        }),
      });
      setLink(result.link);
      setSuccess("บันทึกการตั้งค่าแล้ว");
    } catch (error) {
      setError(errorText(error));
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Link to="/history" className="text-link mb-4">
        <ArrowLeft size={16} aria-hidden="true" />
        กลับไปประวัติลิงก์
      </Link>
      <div className="page-heading">
        <h1>รายละเอียดลิงก์</h1>
        <p className="muted">QR Code การตั้งค่า และสถิติของลิงก์นี้</p>
      </div>
      <Feedback error={error} loading={!link && !error} />
      {link && (
        <>
          <LinkResult link={link} />
          <section className="panel">
            <h2 className="section-heading">
              <Settings2 size={21} aria-hidden="true" />
              ตั้งค่าลิงก์
            </h2>
            <form onSubmit={save}>
              <div className="settings-grid">
                <div>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(event) => {
                        setActive(event.target.checked);
                        setSuccess("");
                      }}
                    />
                    เปิดใช้งานลิงก์
                  </label>
                  <p className="muted text-sm">
                    เมื่อปิด ผู้เปิดลิงก์จะไม่ถูกส่งต่อ
                  </p>
                </div>
                <div>
                  <label htmlFor="edit-expiry">
                    วันหมดอายุ (เว้นว่างเพื่อไม่กำหนด)
                  </label>
                  <input
                    id="edit-expiry"
                    type="datetime-local"
                    value={expiry}
                    onChange={(event) => {
                      setExpiry(event.target.value);
                      setSuccess("");
                    }}
                  />
                  <p className="muted text-sm mt-2">
                    เวลาท้องถิ่น · เว้นว่างเพื่อไม่กำหนดวันหมดอายุ
                  </p>
                </div>
              </div>
              <p className="muted text-sm my-4">
                สร้างเมื่อ {thaiDate(link.createdAt)} · URL
                ปลายทางและชื่อลิงก์คงที่หลังสร้าง
              </p>
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
              </button>
              {success && (
                <p role="status" className="success-text mt-3">
                  {success}
                </p>
              )}
            </form>
          </section>
          <Analytics id={link.id} />
        </>
      )}
    </>
  );
}
