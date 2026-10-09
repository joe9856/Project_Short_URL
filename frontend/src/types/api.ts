export interface User {
  id: string;
  name: string;
  email: string;
}
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
export interface Stats {
  totalLinks: number;
  activeLinks: number;
  totalClicks: number;
  clicksByDate: { date: string; clicks: number }[];
  devices: { name: string; clicks: number }[];
  sources: { name: string; clicks: number }[];
  range: { from: string; to: string; timezone: string };
}
export interface LinkList {
  links: ShortLink[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
}
