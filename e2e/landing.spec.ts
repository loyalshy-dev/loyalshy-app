import { test, expect } from "@playwright/test"

test.describe("Landing Page", () => {
  test("renders hero section", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("has navigation with login/register links", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: /sign in|log in/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /get started|sign up|start free/i })).toBeVisible()
  })

  test("shows pricing section", async ({ page }) => {
    await page.goto("/")
    const pricing = page.getByText(/pricing/i).first()
    await expect(pricing).toBeVisible()
  })

  test("navigates to login from navbar", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: /sign in|log in/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})
