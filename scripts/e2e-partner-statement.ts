/* Smoke: admin opens /admin/partners, generates the August 2026 statement
 * for the seeded partner, and the page renders totals + org lines. */
import { chromium } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { hashPassword } from "better-auth/crypto"
import { config } from "dotenv"

config({ path: "/Users/themorell99/Desktop/loyalshy/loyalshy-app/.env.local" })

const BASE = "http://localhost:3000"
const SHOT_DIR =
  "/private/tmp/claude-501/-Users-themorell99-Desktop-loyalshy/086a1e59-b4de-4ba6-b24d-3fb203f48258/scratchpad"

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

  // Seed an admin account (billing tier is enough for the page)
  const email = "billing-admin@loyalshy.test"
  let admin = await db.user.findUnique({ where: { email } })
  if (!admin) {
    admin = await db.user.create({
      data: { name: "Billing Admin", email, emailVerified: true, role: "ADMIN_BILLING" },
    })
    await db.account.create({
      data: {
        userId: admin.id,
        providerId: "credential",
        accountId: admin.id,
        password: await hashPassword("admin1234x"),
      },
    })
    console.log("seeded", email)
  }

  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  page.setDefaultTimeout(20_000)
  try {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', "admin1234x")
    await page.click('button[type="submit"]')
    await page.waitForURL("**/dashboard**")

    await page.goto(`${BASE}/admin/partners`)
    await page.waitForSelector("text=Partner statements")
    console.log("✓ page renders")

    // Partner is preselected (only one); pick August 2026 and generate
    await page.fill("#statement-month", "2026-08")
    await page.click('button:has-text("Generate statement")')
    await page.waitForSelector("text=Net payout to partner")
    console.log("✓ statement generated")

    const lines = await page.locator("table tbody tr").count()
    console.log("✓ org lines rendered:", lines)
    await page.screenshot({ path: `${SHOT_DIR}/e2e-partner-statement.png`, fullPage: true })
    console.log("\n✅ statement page smoke PASSED")
  } catch (err) {
    await page.screenshot({ path: `${SHOT_DIR}/e2e-failure.png` }).catch(() => {})
    console.error("\n❌ FAILED:", err)
    process.exitCode = 1
  } finally {
    await browser.close()
    await db.$disconnect()
  }
}

main()
