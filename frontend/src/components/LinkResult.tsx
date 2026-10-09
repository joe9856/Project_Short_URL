import { useState } from "react";
import { Copy, Check, Download, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { ShortLink } from "../types/api";
import { thaiDate } from "../services/api";
import { Feedback } from "./Feedback";

export function LinkResult({ link }: { link: ShortLink }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [qrError, setQrError] = useState(false);
  const [qrVersion, setQrVersion] = useState(0);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link.shortUrl);
      setCopied(true);
      setError("");
    } catch {
      setError("คัดลอกไม่ได้ กรุณาเลือกลิงก์แล้วคัดลอกเอง");
    }
  }
  return (
    <section className="result-panel" aria-label="ลิงก์ที่สร้าง">
      <div className="result-grid">
        <div>
          <span className={"status status-" + link.status}>
            {link.status === "active"
              ? "ใช้งานอยู่"
              : link.status === "expired"
                ? "หมดอายุ"
                : "ปิดใช้งาน"}
          </span>
          <a
            className="short-url"
            href={link.shortUrl}
            target="_blank"
            rel="noreferrer"
          >
            {link.shortUrl}
            <ExternalLink size={16} aria-label="เปิดในแท็บใหม่" />
          </a>
          <p className="url-text muted mt-3">{link.originalUrl}</p>
          <p className="muted text-sm mt-3">
            สร้างเมื่อ {thaiDate(link.createdAt)} ·{" "}
            {(link.clicks || 0).toLocaleString("th-TH")} คลิก
          </p>
          <div className="actions mt-4">
            <button className="btn btn-primary" onClick={copy}>
              {copied ? (
                <Check size={17} aria-hidden="true" />
              ) : (
                <Copy size={17} aria-hidden="true" />
              )}
              {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
            </button>
            <Link className="text-link" to={"/links/" + link.id}>
              ดูรายละเอียด →
            </Link>
          </div>
          {copied && (
            <p role="status" className="success-text mt-3">
              คัดลอกลิงก์สั้นแล้ว
            </p>
          )}
        </div>
        <div className="qr-panel">
          <h2>QR Code พร้อมแชร์</h2>
          {qrError ? (
            <>
              <Feedback error="โหลด QR ไม่สำเร็จ" />
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setQrError(false);
                  setQrVersion(qrVersion + 1);
                }}
              >
                ลองใหม่
              </button>
            </>
          ) : (
            <img
              className="qr-image"
              src={"/api/links/" + link.id + "/qr?format=png&v=" + qrVersion}
              alt={"QR Code ของ " + link.shortUrl}
              width="240"
              height="240"
              onError={() => setQrError(true)}
            />
          )}
          <div className="actions">
            {["png", "svg"].map((format) => (
              <a
                key={format}
                className="btn btn-secondary"
                href={
                  "/api/links/" +
                  link.id +
                  "/qr?format=" +
                  format +
                  "&download=1"
                }
              >
                <Download size={16} aria-hidden="true" />
                {format.toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      </div>
      <Feedback error={error} />
    </section>
  );
}
