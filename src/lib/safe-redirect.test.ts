import { describe, it, expect } from "vitest"
import { safeRedirectPath } from "./safe-redirect"

const FALLBACK = "/dashboard"

describe("safeRedirectPath", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeRedirectPath("/dashboard/contacts", FALLBACK)).toBe("/dashboard/contacts")
    expect(safeRedirectPath("/dashboard/settings?tab=team#invite", FALLBACK)).toBe(
      "/dashboard/settings?tab=team#invite"
    )
  })

  it("falls back when missing or empty", () => {
    expect(safeRedirectPath(null, FALLBACK)).toBe(FALLBACK)
    expect(safeRedirectPath(undefined, FALLBACK)).toBe(FALLBACK)
    expect(safeRedirectPath("", FALLBACK)).toBe(FALLBACK)
  })

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeRedirectPath("https://evil.example", FALLBACK)).toBe(FALLBACK)
    expect(safeRedirectPath("//evil.example/path", FALLBACK)).toBe(FALLBACK)
    expect(safeRedirectPath("evil.example", FALLBACK)).toBe(FALLBACK)
  })

  it("rejects backslash and control-character tricks", () => {
    expect(safeRedirectPath("/\\evil.example", FALLBACK)).toBe(FALLBACK)
    expect(safeRedirectPath("/\\/evil.example", FALLBACK)).toBe(FALLBACK)
    expect(safeRedirectPath("/\t/evil.example", FALLBACK)).toBe(FALLBACK)
    expect(safeRedirectPath("/\n/evil.example", FALLBACK)).toBe(FALLBACK)
  })

  it("rejects script URLs", () => {
    expect(safeRedirectPath("javascript:alert(1)", FALLBACK)).toBe(FALLBACK)
    expect(safeRedirectPath("data:text/html,hi", FALLBACK)).toBe(FALLBACK)
  })

  it("normalizes dot segments without leaving the site", () => {
    expect(safeRedirectPath("/dashboard/../admin", FALLBACK)).toBe("/admin")
    expect(safeRedirectPath("/../../evil.example", FALLBACK)).toBe("/evil.example")
  })
})
