/**
 * Backfill CardDesign for all existing restaurants.
 * Run with: npx tsx scripts/migrate-card-design.ts
 */

import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import crypto from "crypto"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

function computeTextColor(hexBg: string): string {
  const cleaned = hexBg.replace("#", "")
  const r = parseInt(cleaned.substring(0, 2), 16) / 255
  const g = parseInt(cleaned.substring(2, 4), 16) / 255
  const b = parseInt(cleaned.substring(4, 6), 16) / 255

  const sR = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
  const sG = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
  const sB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)

  const lum = 0.2126 * sR + 0.7152 * sG + 0.0722 * sB
  return lum > 0.179 ? "#1a1a1a" : "#ffffff"
}

function computeHash(design: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(JSON.stringify(design)).digest("hex").substring(0, 16)
}

async function main() {
  console.log("Starting CardDesign backfill...")

  const restaurants = await db.restaurant.findMany({
    select: {
      id: true,
      brandColor: true,
      secondaryColor: true,
    },
  })

  console.log(`Found ${restaurants.length} restaurants`)

  let created = 0
  let skipped = 0

  for (const r of restaurants) {
    // Check if card design already exists
    const existing = await db.cardDesign.findUnique({
      where: { restaurantId: r.id },
    })

    if (existing) {
      skipped++
      continue
    }

    const primaryColor = r.brandColor ?? "#1a1a2e"
    const secondaryColor = r.secondaryColor ?? "#ffffff"
    const textColor = computeTextColor(primaryColor)

    const hashPayload = {
      s: "CLEAN",
      p: primaryColor,
      sc: secondaryColor,
      t: textColor,
      si: null,
      sig: null,
      ps: "NONE",
      ga: null,
      gg: null,
      bh: null,
      ma: null,
      sl: {},
      cm: null,
    }

    await db.cardDesign.create({
      data: {
        restaurantId: r.id,
        shape: "CLEAN",
        primaryColor,
        secondaryColor,
        textColor,
        patternStyle: "NONE",
        socialLinks: {},
        designHash: computeHash(hashPayload),
      },
    })

    created++
  }

  console.log(`Done! Created: ${created}, Skipped (already exists): ${skipped}`)
  await db.$disconnect()
}

main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
