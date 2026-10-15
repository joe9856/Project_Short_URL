// Type ของ JSON บัญชีจาก Auth Service → App เก็บใน State → Navigation/Auth/Profile/Dashboard ใช้
// interface อธิบายชนิดให้ TypeScript ตอนพัฒนา ไม่ใช่ฟังก์ชันตรวจ Response ตอนรัน
export interface User {
  id: string;
  name: string;
  email: string;
}
// Link Service publicLink เพิ่ม shortUrl/status ให้แถวจาก DB → CreateForm/History/LinkDetails → LinkResult
export interface ShortLink {
  id: string;
  code: string;
  originalUrl: string;
  shortUrl: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  status: "active" | "expired" | "disabled";
  clicks?: number;
}
// Analytics Service statistics คืน { stats: ... } → Analytics Component ใช้สร้างการ์ด/กราฟ/ตาราง
export interface Stats {
  totalLinks: number;
  activeLinks: number;
  totalClicks: number;
  clicksByDate: { date: string; clicks: number }[];
  devices: { name: string; clicks: number }[];
  sources: { name: string; clicks: number }[];
  range: { from: string; to: string; timezone: string };
}
// Link Service listLinks รวมรายการ + จำนวนคลิกจาก Analytics + pagination → History แสดงและแบ่งหน้า
export interface LinkList {
  links: ShortLink[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
}
