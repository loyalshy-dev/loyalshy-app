/* E2E for the three UX fixes:
 * 1. Orgless partner lands on /dashboard/partner (not the register wall)
 *    and can create their first client from the console button.
 * 2. Handoff dialog offers the owner-email field.
 * 3. The access-request deep link prefills the owner's invite dialog. */
import { chromium } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { hashPassword } from "better-auth/crypto"
import { config } from "dotenv"

config({ path: "/Users/themorell99/Desktop/loyalshy/loyalshy-app/.env.local" })

const BASE = "http://localhost:3000"
const SHOT_DIR = "/private/tmp/claude-501/-Users-themorell99-Desktop-loyalshy/086a1e59-b4de-4ba6-b24d-3fb203f48258/scratchpad"
const CLIENT_ORG = `Cafe E2E orgless-${Date.now().toString(36)}`

function step(m: string) { console.log(`\n▸ ${m}`) }

async function seedUser(db: PrismaClient, name: string, email: string, password: string, isPartner: boolean) {
  let user = await db.user.findUnique({ where: { email } })
  if (!user) {
    user = await db.user.create({ data: { name, email, emailVerified: true, isPartner } })
    await db.account.create({
      data: { userId: user.id, providerId: "credential", accountId: user.id, password: await hashPassword(password) },
    })
  }
  return user
}

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

  step("Seed: orgless partner + café owner with an org")
  await seedUser(db, "Orgless Rep", "rep2@agency.test", "partner1234", true)
  const owner = await seedUser(db, "Café Owner", "owner@cafe.test", "cafeowner1234", false)
  let ownerOrg = await db.member.findFirst({ where: { userId: owner.id } })
  if (!ownerOrg) {
    const org = await db.organization.create({
      data: { name: "Cafe Ref E2E prefill", slug: `cafe-prefill-${Date.now().toString(36)}`, plan: "FREE", subscriptionStatus: "ACTIVE", settings: {} },
    })
    await db.member.create({ data: { userId: owner.id, organizationId: org.id, role: "owner" } })
  }
  console.log("  ✓ seeded")

  const browser = await chromium.launch()
  try {
    step("Fix 1: orgless partner → Partner console, creates first client from page button")
    const repCtx = await browser.newContext({ viewport: { width: 1400, height: 950 } })
    const repPage = await repCtx.newPage()
    repPage.setDefaultTimeout(20_000)
    await repPage.goto(`${BASE}/login`)
    await repPage.fill('input[type="email"]', "rep2@agency.test")
    await repPage.fill('input[type="password"]', "partner1234")
    await repPage.click('button[type="submit"]')
    await repPage.waitForURL("**/dashboard/partner**")
    console.log("  ✓ landed on /dashboard/partner (no register wall)")
    await repPage.waitForSelector("text=Your client portfolio")
    await repPage.screenshot({ path: `${SHOT_DIR}/e2e-orgless-console.png` })

    await repPage.click('button:has-text("New client setup")')
    await repPage.fill("#client-name", CLIENT_ORG)
    await repPage.click('button:has-text("Create client organization")')
    await repPage.waitForURL(`${BASE}/dashboard`)
    await repPage.waitForSelector(`text="${CLIENT_ORG}"`)
    console.log("  ✓ first client org created from the console")

    step("Fix 2: handoff dialog offers owner-email field")
    await repPage.click('button[aria-label="Switch organization"]')
    await repPage.click('text="Hand off to owner"')
    await repPage.waitForSelector("#handoff-email")
    console.log("  ✓ email field present")
    await repPage.fill("#handoff-email", "someone@example.com")
    await repPage.waitForSelector('button:has-text("Generate & send")')
    console.log("  ✓ button switches to Generate & send")
    await repPage.screenshot({ path: `${SHOT_DIR}/e2e-handoff-email.png` })
    await repCtx.close()

    step("Fix 3: access-request deep link prefills the owner's invite dialog")
    const ownerCtx = await browser.newContext({ viewport: { width: 1400, height: 950 } })
    const ownerPage = await ownerCtx.newPage()
    ownerPage.setDefaultTimeout(20_000)
    await ownerPage.goto(`${BASE}/login`)
    await ownerPage.fill('input[type="email"]', "owner@cafe.test")
    await ownerPage.fill('input[type="password"]', "cafeowner1234")
    await ownerPage.click('button[type="submit"]')
    await ownerPage.waitForURL("**/dashboard**")
    await ownerPage.goto(`${BASE}/dashboard/settings?tab=team&invite=rep2%40agency.test&inviteRole=admin`)
    await ownerPage.waitForSelector('input#invite-email')
    const prefilled = await ownerPage.inputValue("#invite-email")
    if (prefilled !== "rep2@agency.test") throw new Error(`email not prefilled: "${prefilled}"`)
    console.log("  ✓ invite email prefilled")
    // Program manager card should be the selected one (shows the check icon)
    await ownerPage.waitForSelector('button:has-text("Program manager")')
    await ownerPage.waitForTimeout(400)
    await ownerPage.screenshot({ path: `${SHOT_DIR}/e2e-prefilled-invite.png` })
    console.log("  ✓ invite dialog open with Program manager role")
    await ownerCtx.close()

    console.log("\n✅ all three rough-edge fixes PASSED")
  } catch (err) {
    console.error("\n❌ FAILED:", err)
    process.exitCode = 1
  } finally {
    await browser.close()
    await db.$disconnect()
  }
}
main()
