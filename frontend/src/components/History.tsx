import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  History as HistoryIcon,
  Search,
  ArrowUpRight,
  Power,
} from "lucide-react";
import { api, errorText, thaiDate } from "../services/api";
import type { LinkList, ShortLink } from "../types/api";
import { Feedback } from "./Feedback";
// Dashboard/HistoryPage เรียกใช้รายการนี้; refresh กระตุ้นการดึงใหม่ และ onUpdated แจ้งหน้าที่ครอบอยู่
export function History({
  refresh = 0,
  onUpdated,
}: {
  refresh?: number;
  onUpdated?: () => void;
}) {
  const [data, setData] = useState<LinkList | null>(null);
  const [search, setSearch] = useState(""); // ข้อความที่กำลังพิมพ์ ยังไม่เรียก API
  const [query, setQuery] = useState(""); // คำค้นที่ยืนยันด้วย Submit แล้ว ใช้ส่งให้ Backend
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null); // id ที่กำลังบันทึก; null หมายถึงไม่ได้บันทึก
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  // ดึงประวัติหลัง React อัปเดตหน้าจอครั้งแรก และเมื่อคำค้น/ตัวกรอง/หน้า/ตัวกระตุ้นเปลี่ยน
  useEffect(() => {
    let current = true; // ใช้กันผลของคำขอเก่ามาเปลี่ยน State หลัง Cleanup; ไม่ได้ยกเลิก HTTP Request
    setLoading(true);
    setError("");
    // GET /api/links → Gateway → Link controller.list → listLinks + Analytics.clickCounts → { links, pagination } กลับ setData
    // query string ส่งคำค้น/สถานะ/เลขหน้าให้ Backend เลือกข้อมูล ครั้งละ 10 รายการ
    api<LinkList>(
      "/api/links?" +
        new URLSearchParams({
          page: String(page),
          pageSize: "10",
          search: query,
          status,
        }),
    )
      .then((result) => {
        if (!current) return;
        if (result.links.length === 0 && page > 1) { // ถ้าหน้าที่เลือกไม่มีข้อมูลแล้ว ให้กลับไปหน้าที่มีอยู่
          setPage(Math.max(1, result.pagination.pages));
        } else {
          setData(result);
        }
      })
      .catch((error) => {
        if (current) setError(errorText(error));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false; // Cleanup ก่อน Effect รอบใหม่หรือเมื่อถอด Component ทำให้ผลคำขอรอบนี้ถูกละทิ้ง
    };
  }, [query, status, page, refresh, retry]);
  // ปุ่มของแต่ละแถวเรียกฟังก์ชันนี้ เพื่อสลับเปิด/ปิดลิงก์ผ่าน Backend
  async function toggleLink(link: ShortLink) {
    if (savingId) return; // กันการส่งคำขอซ้อนระหว่างกำลังบันทึก
    setSavingId(link.id);
    setActionError("");
    setSuccess("");
    try {
      // PATCH → Link controller.update → updateLink/Prisma → { link } ใหม่กลับมาแทนแถวใน State
      const result = await api<{ link: ShortLink }>("/api/links/" + link.id, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !link.isActive }), // ! กลับค่า boolean แล้วส่ง PATCH แก้เฉพาะสถานะ
      });
      // อ่าน State ล่าสุด แล้วสร้าง object/array ใหม่; แทนเฉพาะแถวที่ id ตรงกับลิงก์ที่บันทึก
      setData((current) =>
        current
          ? {
              ...current,
              links: current.links.map((item) =>
                item.id === link.id ? { ...item, ...result.link } : item,
              ),
            }
          : current,
      );
      setSuccess(
        result.link.status === "expired"
          ? `ลิงก์ ${link.code} ยังหมดอายุอยู่ กรุณาแก้วันหมดอายุในหน้ารายละเอียด`
          : `${result.link.isActive ? "เปิด" : "ปิด"}ใช้งานลิงก์ ${link.code} แล้ว`,
      );
      // อ่านรายการใหม่เพื่อให้ตัวกรองและจำนวนหน้าตรงกับสถานะล่าสุด
      if (onUpdated) onUpdated();
      else setRetry((value) => value + 1);
    } catch (error) {
      setActionError(
        `บันทึกสถานะลิงก์ ${link.code} ไม่สำเร็จ: ${errorText(error)}`,
      );
    } finally {
      setSavingId(null); // คืนปุ่มให้กดได้เมื่อคำขอจบ ไม่ว่าจะสำเร็จหรือผิดพลาด
    }
  }
  return (
    <section className="panel" id="history">
      <div className="section-heading">
        <HistoryIcon size={22} aria-hidden="true" />
        <h2>ประวัติลิงก์</h2>
      </div>
      {/* Submit ยืนยันคำค้นและกลับหน้า 1; เปลี่ยน select จะกรองทันทีผ่าน Effect */}
      <form
        className="history-tools"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(search);
        }}
      >
        <div className="search-control">
          <label className="sr-only" htmlFor="search">
            ค้นหาลิงก์
          </label>
          <Search size={18} aria-hidden="true" />
          <input
            id="search"
            placeholder="ค้นหา URL หรือชื่อลิงก์"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={200}
            disabled={savingId !== null}
          />
        </div>
        <button className="btn btn-secondary" disabled={savingId !== null}>
          ค้นหา
        </button>
        <label className="sr-only" htmlFor="status-filter">
          สถานะลิงก์
        </label>
        <select
          id="status-filter"
          value={status}
          disabled={savingId !== null}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">ทุกสถานะ</option>
          <option value="active">ใช้งานอยู่</option>
          <option value="disabled">ปิดใช้งาน</option>
          <option value="expired">หมดอายุ</option>
        </select>
      </form>
      <Feedback error={actionError} />
      {success && (
        <p className="success-text mt-3" role="status">
          {success}
        </p>
      )}
      {/* เลือกแสดงกำลังโหลด/ข้อผิดพลาด/รายการ; รายการว่างมีข้อความแนะนำแทน */}
      {loading ? (
        <Feedback loading />
      ) : error ? (
        <>
          <Feedback error={error} />
          <button
            className="btn btn-secondary mt-3"
            onClick={() => setRetry(retry + 1)}
          >
            ลองใหม่
          </button>
        </>
      ) : (
        data && (
          <>
            {data.links.length === 0 ? (
              <div className="empty-state">
                <Link2Empty />
                <h3>ยังไม่มีลิงก์ที่ตรงกับรายการนี้</h3>
                <p className="muted">
                  สร้างลิงก์แรก หรือเปลี่ยนคำค้นและตัวกรอง
                </p>
              </div>
            ) : (
              <div className="history-list">
                <div className="history-row history-label" aria-hidden="true">
                  <span>ลิงก์ / URL ต้นฉบับ</span>
                  <span>สถานะ / จัดการ</span>
                  <span>คลิก</span>
                  <span>สร้างเมื่อ</span>
                </div>
                {data.links.map((link) => {
                  // ตรวจทั้งสถานะจาก API และวันหมดอายุ เพื่อป้องกันเปิดลิงก์ที่หมดอายุจากปุ่มนี้
                  const expired =
                    link.status === "expired" ||
                    (link.expiresAt !== null &&
                      new Date(link.expiresAt).getTime() <= Date.now());
                  return (
                    <article className="history-row link-row" key={link.id}>
                      <div className="min-w-0">
                        {/* เปลี่ยน Frontend Route; LinkDetails จะอ่าน id แล้ว GET รายละเอียดเอง */}
                        <Link className="history-link" to={`/links/${link.id}`}>
                          {link.code}
                          <ArrowUpRight size={15} aria-hidden="true" />
                        </Link>
                        <p className="url-text muted text-sm">
                          {link.originalUrl}
                        </p>
                      </div>
                      <div className="history-status-control">
                        <span className={"status status-" + link.status}>
                          {link.status === "active"
                            ? "ใช้งานอยู่"
                            : link.status === "expired"
                              ? "หมดอายุ"
                              : "ปิดใช้งาน"}
                        </span>
                        {/* ส่ง link ของแถวนี้ให้ toggleLink เมื่อกด; ปิดปุ่มเมื่อบันทึกหรือพยายามเปิดลิงก์หมดอายุ */}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          aria-label={`${link.isActive ? "ปิด" : "เปิด"}ใช้งานลิงก์ ${link.code}`}
                          aria-busy={savingId === link.id}
                          aria-describedby={
                            expired ? `expiry-${link.id}` : undefined
                          }
                          disabled={
                            savingId !== null || (!link.isActive && expired)
                          }
                          onClick={() => toggleLink(link)}
                        >
                          <Power size={14} aria-hidden="true" />
                          {savingId === link.id
                            ? "กำลังบันทึก"
                            : link.isActive
                              ? "ปิดลิงก์"
                              : "เปิดลิงก์"}
                        </button>
                        {expired && (
                          <Link
                            id={`expiry-${link.id}`}
                            className="text-link"
                            to={`/links/${link.id}`}
                          >
                            แก้วันหมดอายุ
                          </Link>
                        )}
                      </div>
                      <span className="click-count">
                        {(link.clicks || 0).toLocaleString("th-TH")}{" "}
                        <span className="mobile-label">คลิก</span>
                      </span>
                      <span className="muted text-sm">
                        {thaiDate(link.createdAt)}
                      </span>
                    </article>
                  );
                })}
              </div>
            )}
            {/* ปุ่มเปลี่ยน page ใน State → Effect ส่ง GET ใหม่; จำนวนหน้ามาจาก Backend */}
            <div className="pagination">
              <p className="muted text-sm">
                {data.pagination.total} ลิงก์ · หน้า {page} /{" "}
                {Math.max(1, data.pagination.pages)}
              </p>
              <div className="actions">
                <button
                  className="btn btn-secondary"
                  disabled={page <= 1 || savingId !== null}
                  onClick={() => setPage(page - 1)}
                >
                  ก่อนหน้า
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={page >= data.pagination.pages || savingId !== null}
                  onClick={() => setPage(page + 1)}
                >
                  ถัดไป
                </button>
              </div>
            </div>
          </>
        )
      )}
    </section>
  );
}
// ชิ้นส่วนไอคอนสำหรับรายการว่าง ไม่มีการเรียก API
function Link2Empty() {
  return <HistoryIcon size={28} aria-hidden="true" />;
}
