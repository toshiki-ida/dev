import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create PrismaClient singleton
// Prisma 7 reads DATABASE_URL from prisma.config.ts
const prismaClientSingleton = () => {
  return new PrismaClient();
};

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export default prisma;
