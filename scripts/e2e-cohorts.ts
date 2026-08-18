import { chromium } from "@playwright/test"
const BASE = "http://localhost:3000"
const SHOT_DIR = "/private/tmp/claude-501/-Users-themorell99-Desktop-loyalshy/086a1e59-b4de-4ba6-b24d-3fb203f48258/scratchpad"

async function main() {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  page.setDefaultTimeout(20_000)
  try {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', "billing-admin@loyalshy.test")
    await page.fill('input[type="password"]', "admin1234x")
    await page.click('button[type="submit"]')
    await page.waitForURL("**/dashboard**")
    await page.goto(`${BASE}/admin/cohorts`)
    await page.waitForSelector("text=Cohort retention")
    console.log("✓ page renders")
    await page.click('button:has-text("Partner-attributed")')
    await page.waitForSelector("table tbody tr")
    const rows = await page.locator("table tbody tr").count()
    console.log("✓ partner segment rows:", rows)
    await page.click('button:has-text("All")')
    await page.screenshot({ path: `${SHOT_DIR}/e2e-cohorts.png`, fullPage: true })
    console.log("\n✅ cohorts page smoke PASSED")
  } catch (err) {
    await page.screenshot({ path: `${SHOT_DIR}/e2e-failure.png` }).catch(() => {})
    console.error("\n❌ FAILED:", err)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
main()
