import { useId } from "react";
import { ArrowUpRight, Link2, QrCode } from "lucide-react";

// Home/Dashboard ส่ง headingLevel → เลือก tag หัวข้อ → คืน JSX ส่วนแนะนำ; ข้อมูลคงที่ ไม่มี API/ฐานข้อมูลใน Component นี้
export function ShortUrlHero({
  headingLevel = "h1",
}: {
  headingLevel?: "h1" | "h2";
}) {
  const titleId = useId(); // สร้าง id สำหรับเชื่อม aria-labelledby กับหัวข้อ ให้เครื่องอ่านหน้าจอรู้ชื่อส่วนนี้
  const Heading = headingLevel; // เลือก tag h1 หรือ h2; ใช้ตัวแปรตัวใหญ่ใน JSX เป็น <Heading>
  return (
    <section className="home-heading" aria-labelledby={titleId}>
      <div className="home-heading-copy">
        <p className="eyebrow home-eyebrow">
          <span className="accent-rule" />
          ลิงก์เล็กลง โอกาสมากขึ้น
        </p>
        <Heading id={titleId} className="home-title">
          <span className="home-title-lead">ย่อลิงก์ พร้อมแชร์</span>{" "}
          <span className="home-title-accent">
            ด้วย <span className="home-title-latin">QR Code</span>
            <ArrowUpRight aria-hidden="true" />
          </span>
        </Heading>
        <p className="home-description">
          เปลี่ยน URL ยาวให้เป็นลิงก์ที่จดจำง่าย
          <br className="home-description-break" />
          พร้อมติดตามทุกการเปิดในที่เดียว
        </p>
      </div>
      {/* ภาพ QR และ short.link/hello เป็นตัวอย่างตกแต่ง ไม่ใช่ QR หรือลิงก์ที่สร้างจาก API */}
      <div className="home-share-art" aria-hidden="true">
        <div className="home-qr-frame">
          <span className="home-art-label">SCAN & SHARE</span>
          <QrCode className="home-qr-symbol" strokeWidth={1.5} />
          <span className="home-art-sample">ตัวอย่าง</span>
        </div>
        <div className="home-link-strip">
          <Link2 size={18} />
          <span>short.link/hello</span>
          <ArrowUpRight size={16} />
        </div>
        <span className="home-art-caption">ลิงก์เดียว แชร์ได้ทุกที่</span>
      </div>
    </section>
  );
}
