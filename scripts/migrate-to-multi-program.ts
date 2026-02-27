/**
 * Migration script: Single-program → Multi-program (Enrollment pivot)
 *
 * Run AFTER `prisma migrate dev` has applied the schema changes.
 * This script backfills data from the old single-program model
 * into the new Enrollment-based model.
 *
 * Usage: npx tsx scripts/migrate-to-multi-program.ts
 */

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Starting multi-program migration...")

  // ─── 1. Create Enrollments from Customer data ──────────────
  // For each Customer that has a restaurant, create an Enrollment
  // linked to that restaurant's first LoyaltyProgram, copying
  // cycle/wallet fields from Customer.

  const restaurants = await prisma.restaurant.findMany({
    select: {
      id: true,
      loyaltyPrograms: {
        take: 1,
        orderBy: { createdAt: "asc" },
        select: { id: true },
      },
    },
  })

  let enrollmentsCreated = 0

  for (const restaurant of restaurants) {
    const program = restaurant.loyaltyPrograms[0]
    if (!program) {
      console.log(`  Skipping restaurant ${restaurant.id} — no loyalty program`)
      continue
    }

    // Use raw query to read old Customer fields that no longer exist in Prisma schema
    const customers = await prisma.$queryRaw<
      {
        id: string
        currentCycleVisits: number
        totalVisits: number
        totalRewardsRedeemed: number
        walletPassId: string | null
        walletPassSerialNumber: string | null
        walletPassType: string
      }[]
    >`
      SELECT id, "currentCycleVisits", "totalVisits", "totalRewardsRedeemed",
             "walletPassId", "walletPassSerialNumber", "walletPassType"
      FROM customer
      WHERE "restaurantId" = ${restaurant.id}
    `

    for (const customer of customers) {
      // Check if enrollment already exists (idempotent)
      const existing = await prisma.enrollment.findUnique({
        where: {
          customerId_loyaltyProgramId: {
            customerId: customer.id,
            loyaltyProgramId: program.id,
          },
        },
      })

      if (existing) continue

      await prisma.enrollment.create({
        data: {
          customerId: customer.id,
          loyaltyProgramId: program.id,
          currentCycleVisits: customer.currentCycleVisits ?? 0,
          totalVisits: customer.totalVisits ?? 0,
          totalRewardsRedeemed: customer.totalRewardsRedeemed ?? 0,
          walletPassId: customer.walletPassId,
          walletPassSerialNumber: customer.walletPassSerialNumber,
          walletPassType: customer.walletPassType as "APPLE" | "GOOGLE" | "NONE",
          status: "ACTIVE",
        },
      })
      enrollmentsCreated++
    }
  }

  console.log(`  Created ${enrollmentsCreated} enrollments`)

  // ─── 2. Relink CardDesigns from restaurantId → loyaltyProgramId ──
  // Use raw SQL since the old restaurantId column may still exist

  const cardDesignsMigrated = await prisma.$executeRaw`
    UPDATE card_design cd
    SET "loyaltyProgramId" = lp.id
    FROM loyalty_program lp
    WHERE cd."restaurantId" = lp."restaurantId"
      AND cd."loyaltyProgramId" IS NULL
  `
  console.log(`  Relinked ${cardDesignsMigrated} card designs to programs`)

  // ─── 3. Backfill Visit.enrollmentId ────────────────────────
  // Match visits to enrollments via (customerId, loyaltyProgramId)

  const visitsUpdated = await prisma.$executeRaw`
    UPDATE visit v
    SET "enrollmentId" = e.id
    FROM enrollment e
    WHERE v."customerId" = e."customerId"
      AND v."loyaltyProgramId" = e."loyaltyProgramId"
      AND v."enrollmentId" IS NULL
  `
  console.log(`  Backfilled ${visitsUpdated} visits with enrollmentId`)

  // ─── 4. Backfill Reward.enrollmentId ───────────────────────

  const rewardsUpdated = await prisma.$executeRaw`
    UPDATE reward r
    SET "enrollmentId" = e.id
    FROM enrollment e
    WHERE r."customerId" = e."customerId"
      AND r."loyaltyProgramId" = e."loyaltyProgramId"
      AND r."enrollmentId" IS NULL
  `
  console.log(`  Backfilled ${rewardsUpdated} rewards with enrollmentId`)

  // ─── 5. Backfill WalletPassLog.enrollmentId ────────────────
  // Match via customerId → enrollment

  const logsUpdated = await prisma.$executeRaw`
    UPDATE wallet_pass_log wl
    SET "enrollmentId" = e.id
    FROM enrollment e
    WHERE wl."customerId" = e."customerId"
      AND wl."enrollmentId" IS NULL
  `
  console.log(`  Backfilled ${logsUpdated} wallet pass logs with enrollmentId`)

  // ─── 6. Set LoyaltyProgram.status from old isActive ────────

  const programsActivated = await prisma.$executeRaw`
    UPDATE loyalty_program
    SET status = 'active'
    WHERE status IS NULL OR status = 'active'
  `

  const programsArchived = await prisma.$executeRaw`
    UPDATE loyalty_program
    SET status = 'archived'
    WHERE "isActive" = false
  `
  console.log(`  Set ${programsActivated} programs to ACTIVE, ${programsArchived} to ARCHIVED`)

  // ─── Summary ──────────────────────────────────────────────

  const totalEnrollments = await prisma.enrollment.count()
  const orphanVisits = await prisma.visit.count({ where: { enrollmentId: null } })
  const orphanRewards = await prisma.reward.count({ where: { enrollmentId: null } })

  console.log("\nMigration complete!")
  console.log(`  Total enrollments: ${totalEnrollments}`)
  console.log(`  Orphan visits (no enrollmentId): ${orphanVisits}`)
  console.log(`  Orphan rewards (no enrollmentId): ${orphanRewards}`)

  if (orphanVisits > 0 || orphanRewards > 0) {
    console.log("  WARNING: Some visits/rewards could not be linked to enrollments.")
    console.log("  These may belong to customers without a matching loyalty program.")
  }
}

main()
  .catch((e) => {
    console.error("Migration failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
