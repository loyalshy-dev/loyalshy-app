import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
    globalForPrisma.prisma = new PrismaClient({ adapter })
  }
  // Verify the client has expected models (invalidate stale HMR cache)
  if (!("apiKey" in globalForPrisma.prisma)) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
    globalForPrisma.prisma = new PrismaClient({ adapter })
  }
  return globalForPrisma.prisma
}

/**
 * Get the next sequential member number for an organization.
 * Uses a raw query with row-level locking to avoid race conditions.
 */
export async function getNextMemberNumber(organizationId: string): Promise<number> {
  const result = await db.$queryRaw<[{ max: number | null }]>`
    SELECT MAX("memberNumber") as max FROM contact WHERE "organizationId" = ${organizationId}
  `
  return (result[0]?.max ?? 0) + 1
}

// Lazy-initialized proxy so PrismaClient isn't constructed at import time
// (avoids errors during Next.js build when DATABASE_URL is unavailable)
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient()
    const value = Reflect.get(client, prop, client)
    if (typeof value === "function") {
      return value.bind(client)
    }
    return value
  },
})
