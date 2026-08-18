/* E2E: partner referral link attribution. Rep copies their referral link;
 * a café owner visits it, signs in (verified, org-less account), completes
 * the org step; the org must carry referredById = rep. */
import { chromium } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { hashPassword } from "better-auth/crypto"
import { config } from "dotenv"

config({ path: "/Users/themorell99/Desktop/loyalshy/loyalshy-app/.env.local" })

const BASE = "http://localhost:3000"
const SHOT_DIR =
  "/private/tmp/claude-501/-Users-themorell99-Desktop-loyalshy/086a1e59-b4de-4ba6-b24d-3fb203f48258/scratchpad"
const ORG_NAME = `Cafe Ref E2E ${Date.now().toString(36)}`
const OWNER_EMAIL = `owner-ref-${Date.now().toString(36)}@cafe.test`

function step(msg: string) {
  console.log(`\n▸ ${msg}`)
}

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

  step("Seed a verified org-less café owner")
  const owner = await db.user.create({
    data: { name: "Ref Owner", email: OWNER_EMAIL, emailVerified: true },
  })
  await db.account.create({
    data: {
      userId: owner.id,
      providerId: "credential",
      accountId: owner.id,
      password: await hashPassword("cafeowner1234"),
    },
  })
  console.log("  ✓", OWNER_EMAIL)

  const browser = await chromium.launch()
  try {
    step("Rep opens Referral link dialog")
    const repCtx = await browser.newContext()
    const repPage = await repCtx.newPage()
    repPage.setDefaultTimeout(20_000)
    await repPage.goto(`${BASE}/login`)
    await repPage.fill('input[type="email"]', "rep@agency.test")
    await repPage.fill('input[type="password"]', "partner1234")
    await repPage.click('button[type="submit"]')
    await repPage.waitForURL("**/dashboard**")
    await repPage.click('button[aria-label="Switch organization"]')
    await repPage.click('text="Referral link"')
    const linkInput = repPage.locator('input[readonly]')
    await linkInput.waitFor()
    const referralUrl = await linkInput.inputValue()
    if (!referralUrl.includes("/register?ref=")) throw new Error(`Unexpected link: ${referralUrl}`)
    console.log("  ✓ link:", referralUrl)
    await repCtx.close()

    step("Owner visits referral link (signed out), then signs in and creates org")
    const ownerCtx = await browser.newContext()
    const ownerPage = await ownerCtx.newPage()
    ownerPage.setDefaultTimeout(20_000)
    const localUrl = referralUrl.replace(/^https?:\/\/[^/]+/, BASE)
    await ownerPage.goto(localUrl)
    // ref is parked in localStorage by the register page on mount
    await ownerPage.waitForFunction(() => !!localStorage.getItem("loyalshy_ref"))
    console.log("  ✓ ref parked in localStorage")

    await ownerPage.goto(`${BASE}/login`)
    await ownerPage.fill('input[type="email"]', OWNER_EMAIL)
    await ownerPage.fill('input[type="password"]', "cafeowner1234")
    await ownerPage.click('button[type="submit"]')
    // org-less user ends up on the org step
    await ownerPage.waitForSelector("#org-name")
    console.log("  ✓ landed on org step")
    await ownerPage.fill("#org-name", ORG_NAME)
    await ownerPage.click('button[type="submit"]:has(svg)')
    await ownerPage.waitForURL("**/dashboard**")
    console.log("  ✓ org created, owner on dashboard")
    const refCleared = await ownerPage.evaluate(() => localStorage.getItem("loyalshy_ref"))
    console.log("  ✓ ref cleared after use:", refCleared === null)
    await ownerCtx.close()

    step("Verify DB attribution")
    const org = await db.organization.findFirst({
      where: { name: ORG_NAME },
      select: { referredById: true, referredBy: { select: { email: true } } },
    })
    if (!org) throw new Error("org not found")
    console.log("  referredBy:", org.referredBy?.email)
    if (org.referredBy?.email !== "rep@agency.test") throw new Error("attribution missing")

    console.log("\n✅ E2E referral attribution PASSED")
  } catch (err) {
    console.error("\n❌ E2E FAILED:", err)
    process.exitCode = 1
  } finally {
    await browser.close()
    await db.$disconnect()
  }
}

main()
