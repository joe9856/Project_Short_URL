import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Link2 } from "lucide-react";
import { isReservedName } from "@short/routing";
import { api, errorText } from "../services/api";
import type { ShortLink } from "../types/api";
import { Feedback } from "./Feedback";
import { LinkResult } from "./LinkResult";
// Home/Dashboard เรียกฟอร์มนี้; authenticated ควบคุมปุ่ม และ onCreated แจ้งหน้าหลักหลังสร้างสำเร็จ
export function CreateForm({
  authenticated = true,
  onCreated,
}: {
  authenticated?: boolean;
  onCreated?: () => void;
}) {
  // State เก็บค่าที่ผู้ใช้กรอก; การเปลี่ยน State ยังไม่ได้บันทึกลงฐานข้อมูล
  const [originalUrl, setOriginalUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [link, setLink] = useState<ShortLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // onSubmit เรียกเมื่อส่งฟอร์ม: ตรวจข้อมูล → POST API → เก็บผลเพื่อแสดง LinkResult
  async function submit(event: FormEvent) {
    event.preventDefault(); // หยุดพฤติกรรม Submit แบบรีโหลดหน้าเว็บ
    setLoading(true);
    setError("");
    try {
      // ตรวจชื่อสงวนและ URL เบื้องต้นที่ Frontend; Backend ต้องตรวจข้อมูลซ้ำด้วย
      if (alias && isReservedName(alias))
        throw new Error("ชื่อนี้ระบบใช้แล้ว กรุณาเลือกชื่ออื่น");
      const url = new URL(originalUrl);
      if (
        !["https:", "http:"].includes(url.protocol) || url.username || url.password
      )
        throw new Error("กรุณาใช้ URL แบบ HTTP/HTTPS ที่ไม่มีรหัสผ่าน");
      // เปลี่ยนเวลาในช่องกรอกเป็น UTC ก่อนส่งให้ Backend
      // api.ts → Gateway → Link controller.create → createLink/Prisma → { link } กลับมาเป็น result
      const result = await api<{ link: ShortLink }>("/api/links", {
        method: "POST",
        body: JSON.stringify({
          originalUrl,
          ...(alias ? { alias } : {}), // ... รวม property เข้ากับ object; ไม่ส่ง alias เมื่อเว้นว่าง
          ...(expiresAt
            ? { expiresAt: new Date(expiresAt).toISOString() }
            : {}),
        }),
      });
      setLink(result.link); // ใช้ลิงก์ที่ Backend ตอบกลับหลังสร้างสำเร็จ ไม่ใช่สร้างข้อมูลฐานข้อมูลใน React
      onCreated?.(); // ?. เรียก callback เฉพาะเมื่อมีส่งมา เช่น ให้ Dashboard รีเฟรชประวัติและสถิติ
    } catch (error) {
      setError(errorText(error)); // แปลงข้อผิดพลาดเป็นข้อความให้ Feedback แสดง
    } finally {
      setLoading(false); // ทำทั้งกรณีสำเร็จและผิดพลาด เพื่อจบสถานะกำลังสร้าง
    }
  }
  return (
    <div id="create">
      <section className="panel generator-panel">
        <h2 className="section-heading">
          <Link2 size={22} aria-hidden="true" />
          สร้างลิงก์สั้น
        </h2>
        {/* value อ่านจาก State; onChange เก็บค่าที่พิมพ์; onSubmit จึงเรียก API */}
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
            {/* ปิดปุ่มระหว่างสร้างหรือเมื่อยังไม่ Login; สิทธิ์จริงต้องตรวจที่ Backend */}
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
      {/* มีผลจาก API จึงแสดงลิงก์และ QR; key ที่เปลี่ยนทำให้ LinkResult เริ่ม State ใหม่สำหรับลิงก์ใหม่ */}
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
