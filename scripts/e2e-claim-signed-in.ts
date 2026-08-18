/* Regression: a signed-in user WITH an org opening a claim link must see
 * the claim page (token-flow exemption), not get bounced to /dashboard.
 * Previously broken: the server-side x-pathname check silently failed. */
import { chromium } from "@playwright/test"
const BASE = "http://localhost:3000"
async function main() {
  const browser = await chromium.launch()
  const page = await (await browser.newContext()).newPage()
  page.setDefaultTimeout(20_000)
  try {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', "owner@cafe.test")
    await page.fill('input[type="password"]', "cafeowner1234")
    await page.click('button[type="submit"]')
    await page.waitForURL("**/dashboard**")
    await page.goto(`${BASE}/claim/not-a-real-token`)
    // Must stay on /claim and show the invalid-link card
    await page.waitForSelector("text=Invalid link")
    if (!page.url().includes("/claim/")) throw new Error("bounced away from /claim")
    console.log("✓ signed-in user with org stays on /claim (sees Invalid link card)")
    console.log("✅ PASSED")
  } catch (err) {
    console.error("❌ FAILED:", err)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}
main()
