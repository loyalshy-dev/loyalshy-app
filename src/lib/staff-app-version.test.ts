import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/db", () => ({ db: {} }))
vi.mock("next/server", async () => ({
  ...(await vi.importActual<typeof import("next/server")>("next/server")),
  connection: vi.fn(),
}))

import { checkStaffAppVersion, compareVersions, parseVersion } from "@/lib/staff-app-version"

function req(version?: string) {
  return new Request("https://loyalshy.com/api/v1/auth/me", {
    headers: version ? { "x-app-version": version } : {},
  })
}

describe("parseVersion / compareVersions", () => {
  it("parses dotted numbers and rejects anything else", () => {
    expect(parseVersion("1.2.0")).toEqual([1, 2, 0])
    expect(parseVersion(" 2 ")).toEqual([2])
    expect(parseVersion("1.2.0-beta")).toBeNull()
    expect(parseVersion("")).toBeNull()
    expect(parseVersion(null)).toBeNull()
  })

  it("compares numerically, padding missing parts with 0", () => {
    expect(compareVersions([1, 10, 0], [1, 9, 9])).toBeGreaterThan(0)
    expect(compareVersions([1, 2], [1, 2, 0])).toBe(0)
    expect(compareVersions([1, 1, 5], [1, 2, 0])).toBeLessThan(0)
  })
})

describe("checkStaffAppVersion", () => {
  beforeEach(() => {
    vi.stubEnv("STAFF_APP_MIN_VERSION", "1.3.0")
    vi.stubEnv("STAFF_APP_UPDATE_URL", "")
  })
  afterEach(() => vi.unstubAllEnvs())

  it("lets everything through when no minimum is set", () => {
    vi.stubEnv("STAFF_APP_MIN_VERSION", "")
    expect(checkStaffAppVersion(req("0.1.0"))).toBeNull()
  })

  it("lets old builds without the header through", () => {
    expect(checkStaffAppVersion(req())).toBeNull()
  })

  it("lets current and newer builds through", () => {
    expect(checkStaffAppVersion(req("1.3.0"))).toBeNull()
    expect(checkStaffAppVersion(req("1.10.0"))).toBeNull()
  })

  it("answers 426 UPGRADE_REQUIRED for an older build", async () => {
    vi.stubEnv("STAFF_APP_UPDATE_URL", "https://testflight.apple.com/join/abc")
    const res = checkStaffAppVersion(req("1.2.9"))
    expect(res?.status).toBe(426)
    expect(await res?.json()).toMatchObject({
      status: 426,
      code: "UPGRADE_REQUIRED",
      minVersion: "1.3.0",
      updateUrl: "https://testflight.apple.com/join/abc",
    })
  })
})
