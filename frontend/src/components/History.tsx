import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { History as HistoryIcon, Search, ArrowUpRight } from "lucide-react";
import { api, errorText, thaiDate } from "../services/api";
import type { LinkList } from "../types/api";
import { Feedback } from "./Feedback";
export function History({ refresh = 0 }: { refresh?: number }) {
  const [data, setData] = useState<LinkList | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
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
        if (current) setData(result);
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
          />
        </div>
        <button className="btn btn-secondary">ค้นหา</button>
        <label className="sr-only" htmlFor="status-filter">
          สถานะลิงก์
        </label>
        <select
          id="status-filter"
          value={status}
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
                  <span>สถานะ</span>
                  <span>คลิก</span>
                  <span>สร้างเมื่อ</span>
                </div>
                {data.links.map((link) => (
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
                    <span className={"status status-" + link.status}>
                      {link.status === "active"
                        ? "ใช้งานอยู่"
                        : link.status === "expired"
                          ? "หมดอายุ"
                          : "ปิดใช้งาน"}
                    </span>
                    <span className="click-count">
                      {(link.clicks || 0).toLocaleString("th-TH")}{" "}
                      <span className="mobile-label">คลิก</span>
                    </span>
                    <span className="muted text-sm">
                      {thaiDate(link.createdAt)}
                    </span>
                  </article>
                ))}
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
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  ก่อนหน้า
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={page >= data.pagination.pages}
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
