import { PrismaPg } from "@prisma/adapter-pg"
import { Prisma, PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

/**
 * Dev-only: a client cached on globalThis across HMR can predate a
 * `prisma generate` and miss newly added models. Checks every generated
 * model instead of a hard-coded name — the old `"apiKey" in client` check
 * failed permanently once ApiKey was deleted in the pivot, rebuilding the
 * client (and its pg pool) on EVERY db access.
 */
function isStaleClient(client: PrismaClient): boolean {
  return Object.values(Prisma.ModelName).some(
    (name) => !(name.charAt(0).toLowerCase() + name.slice(1) in client)
  )
}

function getPrismaClient(): PrismaClient {
  if (
    !globalForPrisma.prisma ||
    (process.env.NODE_ENV !== "production" && isStaleClient(globalForPrisma.prisma))
  ) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

/**
 * Get the next sequential member number for an organization.
 * Uses FOR UPDATE to lock rows and prevent race conditions.
 * Pass a transaction client (`tx`) when called inside a $transaction.
 */
export async function getNextMemberNumber(
  organizationId: string,
  tx?: Pick<PrismaClient, "$queryRaw">
): Promise<number> {
  const client = tx ?? db
  const result = await client.$queryRaw<[{ max: number | null }]>`
    SELECT MAX("memberNumber") as max FROM (
      SELECT "memberNumber" FROM contact WHERE "organizationId" = ${organizationId} FOR UPDATE
    ) locked
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
