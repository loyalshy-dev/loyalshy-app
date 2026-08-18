import { chromium } from "@playwright/test"
const BASE = "http://localhost:3000"
const SHOT_DIR = "/private/tmp/claude-501/-Users-themorell99-Desktop-loyalshy/086a1e59-b4de-4ba6-b24d-3fb203f48258/scratchpad"

async function main() {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage()
  page.setDefaultTimeout(20_000)
  try {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', "rep@agency.test")
    await page.fill('input[type="password"]', "partner1234")
    await page.click('button[type="submit"]')
    await page.waitForURL("**/dashboard**")

    await page.click('a[href="/dashboard/partner"]')
    await page.waitForSelector("text=Your client portfolio")
    console.log("✓ console renders via sidebar nav")

    const rows = await page.locator("table tbody tr").count()
    console.log("✓ client rows:", rows)

    await page.screenshot({ path: `${SHOT_DIR}/e2e-partner-console.png`, fullPage: true })
    console.log("\n✅ partner console smoke PASSED")
  } catch (err) {
    await page.screenshot({ path: `${SHOT_DIR}/e2e-failure.png` }).catch(() => {})
    console.error("\n❌ FAILED:", err)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
main()
