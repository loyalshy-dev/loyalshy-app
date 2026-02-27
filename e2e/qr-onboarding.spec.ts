import { test, expect } from "@playwright/test"

test.describe("QR Code Onboarding", () => {
  test("shows 404 for invalid restaurant slug", async ({ page }) => {
    await page.goto("/join/nonexistent-restaurant-slug")
    await expect(page.getByText(/not found|doesn.*exist/i)).toBeVisible()
  })
})
