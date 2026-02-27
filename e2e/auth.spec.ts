import { test, expect } from "@playwright/test"

test.describe("Authentication", () => {
  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test("register page renders step 1", async ({ page }) => {
    await page.goto("/register")
    await expect(page.getByRole("heading", { name: /create.*account/i })).toBeVisible()
  })

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("invalid@test.com")
    await page.getByLabel(/password/i).fill("wrongpassword")
    await page.getByRole("button", { name: /sign in/i }).click()
    // Should show an error toast or message
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 5000 })
  })
})
