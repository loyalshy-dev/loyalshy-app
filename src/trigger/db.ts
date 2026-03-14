import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

/**
 * Creates a fresh PrismaClient for Trigger.dev tasks.
 * Prisma v7 requires an explicit adapter with connectionString
 * since the datasource URL lives in prisma.config.ts (build-time only).
 * Always call `db.$disconnect()` in a finally block.
 */
export function createDb(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}
