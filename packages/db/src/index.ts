import { PrismaClient } from "@prisma/client";

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, "");
}

export const prisma = new PrismaClient();

export * from "@prisma/client";
