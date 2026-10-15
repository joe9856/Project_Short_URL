import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Settings2 } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import type { ShortLink } from "../types/api";
import { api, errorText, thaiDate } from "../services/api";
import { LinkResult } from "../components/LinkResult";
import { Analytics } from "../components/Analytics";
import { Feedback } from "../components/Feedback";
// App เลือกหน้านี้เมื่อ path ตรง /links/:id แล้วหน้าจะโหลดและแก้การตั้งค่าของลิงก์นั้น
export function LinkDetails() {
  const { id } = useParams(); // อ่าน :id จาก Frontend Route เพื่อนำไปประกอบ URL ของ Backend API
  const [link, setLink] = useState<ShortLink | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [expiry, setExpiry] = useState("");
  const [active, setActive] = useState(true);
  const [success, setSuccess] = useState("");
  // โหลดรายละเอียดหลัง React อัปเดตหน้าจอครั้งแรก และเมื่อ id ใน path เปลี่ยน
  useEffect(() => {
    let current = true; // กันผลคำขอเก่าเปลี่ยน State หลัง Cleanup; ไม่ได้ยกเลิก HTTP Request
    api<{ link: ShortLink }>("/api/links/" + id) // Gateway → Link controller.detail → ownedLink/Prisma → { link } กลับ setLink
      .then((result) => {
        if (current) {
          setLink(result.link);
          setActive(result.link.isActive);
          if (result.link.expiresAt) {
            // แปลงเวลาที่ API ส่งมาเป็นเวลาท้องถิ่นรูปแบบ YYYY-MM-DDTHH:mm สำหรับ datetime-local
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
      current = false; // Cleanup ก่อน Effect รอบใหม่หรือเมื่อออกจากหน้านี้
    };
  }, [id]);
  // กดบันทึก → ส่งสถานะ/วันหมดอายุ → ใช้ข้อมูลตอบกลับอัปเดต LinkResult
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      // api.ts → Gateway → Link controller.update → updateLink/Prisma → { link } ใหม่กลับไปแสดง LinkResult
      const result = await api<{ link: ShortLink }>("/api/links/" + id, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: active,
          expiresAt: expiry ? new Date(expiry).toISOString() : null, // แปลงเวลาท้องถิ่นเป็น UTC; null คือยกเลิกวันหมดอายุ
        }),
      });
      setLink(result.link);
      setSuccess("บันทึกการตั้งค่าแล้ว");
    } catch (error) {
      setError(errorText(error));
    } finally {
      setSaving(false); // จบสถานะกำลังบันทึกทั้งเมื่อสำเร็จหรือผิดพลาด
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
      {/* ยังไม่มี link และไม่มี error ให้แสดงกำลังโหลด; มีข้อมูลจึงแสดงส่วนรายละเอียดด้านล่าง */}
      <Feedback error={error} loading={!link && !error} />
      {link && (
        <>
          <LinkResult link={link} />
          <section className="panel">
            <h2 className="section-heading">
              <Settings2 size={21} aria-hidden="true" />
              ตั้งค่าลิงก์
            </h2>
            {/* เปลี่ยน checkbox/เวลาแก้เฉพาะ State; Submit จึงส่ง PATCH ไม่มีการแก้ URL หรือ code */}
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
          {/* ส่ง id ให้ Analytics เรียกสถิติลิงก์นี้ผ่าน /api/links/:id/stats */}
          <Analytics id={link.id} />
        </>
      )}
    </>
  );
}
