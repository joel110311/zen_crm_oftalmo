import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Safe Prisma client initialization to prevent build-time crashes
let prismaInstance: PrismaClient;

try {
    if (globalForPrisma.prisma) {
        prismaInstance = globalForPrisma.prisma;
    } else {
        const connectionString = process.env.DATABASE_URL;
        const pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);
        prismaInstance = new PrismaClient({ adapter, log: ["query"] });
    }
} catch (error) {
    console.warn("Failed to initialize Prisma Client (this is expected during build):", error);
    // Return a proxy or mock to prevent import crashes, but usages will fail if not handled
    prismaInstance = {} as PrismaClient;
}

export const prisma = prismaInstance;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
