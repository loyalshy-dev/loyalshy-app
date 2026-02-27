import { vi } from "vitest"

// ─── Mock "server-only" ─────────────────────────────────────
// This module throws at import time on the client.
// In tests, we stub it to a no-op.
vi.mock("server-only", () => ({}))

// ─── Mock Next.js modules ───────────────────────────────────

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn((fn: Function) => fn),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url)
  }),
  notFound: vi.fn(() => {
    throw new NotFoundError()
  }),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))

// ─── Custom error classes for redirect/notFound assertions ──

export class RedirectError extends Error {
  public readonly url: string
  constructor(url: string) {
    super(`NEXT_REDIRECT: ${url}`)
    this.url = url
    this.name = "RedirectError"
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("NEXT_NOT_FOUND")
    this.name = "NotFoundError"
  }
}
