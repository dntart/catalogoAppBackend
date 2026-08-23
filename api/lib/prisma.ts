import { PrismaClient } from '@prisma/client';

// Singleton global — en serverless, cada invocación podría crear un cliente
// nuevo si no se reusa así, agotando las conexiones de Postgres rápido.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
