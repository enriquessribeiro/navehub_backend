import { PrismaClient } from "@prisma/client";

// Evita criar uma nova instância do PrismaClient a cada hot-reload em
// desenvolvimento (o que esgotaria as conexões do Postgres rapidinho).
declare global {
  // eslint-disable-next-line no-var
  var __navehubPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__navehubPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV === "development") {
  global.__navehubPrisma = prisma;
}
