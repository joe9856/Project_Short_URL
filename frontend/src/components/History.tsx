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
export function History({
  refresh = 0,
  onUpdated,
}: {
  refresh?: number;
  onUpdated?: () => void;
}) {
  const [data, setData] = useState<LinkList | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
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
        if (result.links.length === 0 && page > 1) {
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
      current = false;
    };
  }, [query, status, page, refresh, retry]);
  async function toggleLink(link: ShortLink) {
    if (savingId) return;
    setSavingId(link.id);
    setActionError("");
    setSuccess("");
    try {
      const result = await api<{ link: ShortLink }>("/api/links/" + link.id, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !link.isActive }),
      });
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
      setSavingId(null);
    }
  }
  return (
    <section className="panel" id="history">
      <div className="section-heading">
        <HistoryIcon size={22} aria-hidden="true" />
        <h2>ประวัติลิงก์</h2>
      </div>
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
                  const expired =
                    link.status === "expired" ||
                    (link.expiresAt !== null &&
                      new Date(link.expiresAt).getTime() <= Date.now());
                  return (
                    <article className="history-row link-row" key={link.id}>
                      <div className="min-w-0">
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
function Link2Empty() {
  return <HistoryIcon size={28} aria-hidden="true" />;
}
