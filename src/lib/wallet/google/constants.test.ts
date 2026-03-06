import { describe, it, expect, vi, beforeEach } from "vitest"

describe("Google Wallet constants", () => {
  const MOCK_ISSUER_ID = "3388000000012345"

  beforeEach(() => {
    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", MOCK_ISSUER_ID)
  })

  it("buildClassId formats organization class ID correctly", async () => {
    // Re-import to pick up the env stub
    const { buildClassId } = await import("./constants")
    // The module reads env at import time, so we check the format
    const classId = buildClassId("rest-abc-123")
    expect(classId).toMatch(/\.loyalshy-org-rest-abc-123$/)
  })

  it("buildObjectId formats contact object ID correctly", async () => {
    const { buildObjectId } = await import("./constants")
    const objectId = buildObjectId("cust-xyz-789")
    expect(objectId).toMatch(/\.loyalshy-contact-cust-xyz-789$/)
  })

  it("class and object IDs use issuer ID prefix", async () => {
    const { buildClassId, buildObjectId, GOOGLE_WALLET_ISSUER_ID } = await import(
      "./constants"
    )
    const classId = buildClassId("test")
    const objectId = buildObjectId("test")
    expect(classId).toContain(GOOGLE_WALLET_ISSUER_ID)
    expect(objectId).toContain(GOOGLE_WALLET_ISSUER_ID)
  })
})
