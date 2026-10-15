// Client ที่สร้างจาก prisma/schema.prisma; services/*.ts เรียก prisma เพื่อแปลงคำสั่ง ORM ไป PostgreSQL ของ Service นี้
import { PrismaClient } from "../../generated/client";
// Reuse one connection pool per warm Function instance.
const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalDatabase.prisma ?? new PrismaClient(); // ใช้ instance เดิมถ้ามี เพื่อลดการสร้าง connection pool ซ้ำ
globalDatabase.prisma = prisma;
