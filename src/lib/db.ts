import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Em desenvolvimento o Next recarrega os módulos a cada alteração. Sem guardar
 * o client no globalThis, cada reload abriria um pool novo e o Postgres estouraria
 * o limite de conexões.
 */
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

function criarClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não configurada. Copie o .env.example para .env e preencha.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient = globalParaPrisma.prisma ?? criarClient();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
