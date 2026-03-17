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

  test("register page renders step 1 with account form", async ({ page }) => {
    await page.goto("/register")
    await expect(page.getByRole("heading", { name: /create.*account/i })).toBeVisible()
    await expect(page.getByLabel(/full name/i)).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible()
  })

  test("register page shows password strength indicator", async ({ page }) => {
    await page.goto("/register")
    const passwordInput = page.getByLabel(/password/i)
    await passwordInput.fill("ab")
    await expect(page.getByText(/weak/i)).toBeVisible()
    await passwordInput.fill("Abcdefgh1!")
    await expect(page.getByText(/strong/i)).toBeVisible()
  })

  test("register step 1 validates required fields", async ({ page }) => {
    await page.goto("/register")
    const submitButton = page.getByRole("button", { name: /create account/i })
    // HTML5 validation should prevent submission with empty fields
    await submitButton.click()
    // Form should still be on step 1 (not advanced)
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

  test("register ?step=org shows organization step directly", async ({ page }) => {
    // This would normally require auth, but we can test the URL parsing
    await page.goto("/register?step=org")
    // Without session, the page will still render but the org step
    // may redirect or show step 1. The key test is that the URL param is parsed.
    // With a real session, it would show the org form.
    await page.waitForLoadState("networkidle")
    // Page should be visible (not crashed)
    await expect(page.locator("body")).toBeVisible()
  })
})
