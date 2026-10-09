import { PrismaClient } from "../../generated/client";
// Reuse one connection pool per warm Function instance.
const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalDatabase.prisma ?? new PrismaClient();
globalDatabase.prisma = prisma;
