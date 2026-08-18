import { chromium } from "@playwright/test"
const BASE = "http://localhost:3000"
const SHOT_DIR = "/private/tmp/claude-501/-Users-themorell99-Desktop-loyalshy/086a1e59-b4de-4ba6-b24d-3fb203f48258/scratchpad"

async function main() {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 950 } })).newPage()
  page.setDefaultTimeout(20_000)
  try {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', "owner@cafe.test")
    await page.fill('input[type="password"]', "cafeowner1234")
    await page.click('button[type="submit"]')
    await page.waitForURL("**/dashboard**")
    await page.goto(`${BASE}/dashboard/settings?tab=team`)
    await page.click('button:has-text("Invite")')
    await page.waitForSelector("text=Program manager")
    await page.waitForTimeout(600)
    console.log("✓ invite dialog shows Program manager role")
    await page.screenshot({ path: `${SHOT_DIR}/e2e-invite-roles.png` })
    console.log("✅ PASSED")
  } catch (err) {
    await page.screenshot({ path: `${SHOT_DIR}/e2e-failure.png` }).catch(() => {})
    console.error("❌ FAILED:", err)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
main()
