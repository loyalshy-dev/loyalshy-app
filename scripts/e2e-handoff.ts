/* End-to-end drive of the partner-led onboarding flow against a running
 * dev server (port 3311): rep creates a client org, generates a handoff
 * link, signs out; café owner claims ownership via the link. Verifies the
 * final DB state (roles flipped, token claimed). */
import { chromium } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"

config({ path: "/Users/themorell99/Desktop/loyalshy/loyalshy-app/.env.local" })

const BASE = "http://localhost:3000"
const SHOT_DIR =
  "/private/tmp/claude-501/-Users-themorell99-Desktop-loyalshy/086a1e59-b4de-4ba6-b24d-3fb203f48258/scratchpad"
const CLIENT_ORG_NAME = `Cafe E2E ${Date.now().toString(36)}`

function step(msg: string) {
  console.log(`\n▸ ${msg}`)
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(20_000)

  try {
    step("Rep signs in")
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', "rep@agency.test")
    await page.fill('input[type="password"]', "partner1234")
    await page.click('button[type="submit"]')
    await page.waitForURL("**/dashboard**")
    console.log("  ✓ rep on dashboard")

    step("Open org switcher → New client setup")
    await page.click('button[aria-label="Switch organization"]')
    await page.click('text="New client setup"')
    await page.fill("#client-name", CLIENT_ORG_NAME)
    await page.click('button:has-text("Create client organization")')
    await page.waitForURL("**/dashboard")
    // Sidebar header should now show the new client org
    await page.waitForSelector(`text="${CLIENT_ORG_NAME}"`)
    console.log("  ✓ client org created and active:", CLIENT_ORG_NAME)

    step("Generate handoff link")
    await page.click('button[aria-label="Switch organization"]')
    await page.click('text="Hand off to owner"')
    await page.click('button:has-text("Generate handoff link")')
    const linkInput = page.locator('input[readonly]')
    await linkInput.waitFor()
    const handoffUrl = await linkInput.inputValue()
    if (!handoffUrl.includes("/claim/")) throw new Error(`Unexpected link: ${handoffUrl}`)
    console.log("  ✓ link:", handoffUrl.slice(0, 60) + "...")

    step("Rep signs out; owner opens claim link (fresh context)")
    const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const ownerPage = await ownerCtx.newPage()
    ownerPage.setDefaultTimeout(20_000)
    const localUrl = handoffUrl.replace(/^https?:\/\/[^/]+/, BASE)
    await ownerPage.goto(localUrl)
    await ownerPage.waitForSelector(`text=Take ownership of ${CLIENT_ORG_NAME}`)
    console.log("  ✓ claim page shows org name")

    step("Owner switches to sign-in mode and claims")
    await ownerPage.click('text="Sign in instead"')
    await ownerPage.fill('input[type="email"]', "owner@cafe.test")
    await ownerPage.fill('input[type="password"]', "cafeowner1234")
    await ownerPage.click('button:has-text("Sign in & take ownership")')
    await ownerPage.waitForURL("**/dashboard?welcome=handoff**")
    console.log("  ✓ redirected to /dashboard?welcome=handoff")
    await ownerPage.waitForSelector("text=add your payment details")
    console.log("  ✓ welcome banner visible")
    await ownerPage.screenshot({ path: `${SHOT_DIR}/e2e-owner-dashboard.png` })

    step("Verify DB state")
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    })
    const org = await db.organization.findFirst({
      where: { name: CLIENT_ORG_NAME },
      include: { members: { include: { user: { select: { email: true } } } } },
    })
    if (!org) throw new Error("client org not found in DB")
    const roles = Object.fromEntries(
      org.members.map((m) => [m.user.email, m.role])
    )
    console.log("  members:", roles)
    if (roles["owner@cafe.test"] !== "owner") throw new Error("claimant is not owner")
    if (roles["rep@agency.test"] !== "admin") throw new Error("rep was not demoted to program manager")
    const token = await db.orgHandoffToken.findFirst({ where: { organizationId: org.id } })
    if (!token?.claimedAt) throw new Error("token not marked claimed")
    const audit = await db.orgAuditLog.findMany({
      where: { organizationId: org.id },
      select: { action: true },
    })
    console.log("  audit log:", audit.map((a) => a.action).join(", "))
    const settings = org.settings as Record<string, unknown>
    console.log("  createdByPartner:", settings.createdByPartner ? "set" : "MISSING")
    await db.$disconnect()

    step("Rep still has program-manager access post-handoff")
    // The rep's session is still on the client org (they created it last)
    await page.goto(`${BASE}/dashboard/programs`)
    await page.waitForSelector('button:has-text("Create Program")')
    console.log("  ✓ rep (admin role) sees Create Program")
    await page.goto(`${BASE}/dashboard/settings`)
    await page.waitForURL("**/dashboard", { timeout: 15000 })
    console.log("  ✓ rep is redirected away from owner-only Settings")

    console.log("\n✅ E2E handoff flow PASSED")
    await ownerCtx.close()
  } catch (err) {
    await page.screenshot({ path: `${SHOT_DIR}/e2e-failure.png` }).catch(() => {})
    throw err
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error("\n❌ E2E FAILED:", e)
  process.exit(1)
})
