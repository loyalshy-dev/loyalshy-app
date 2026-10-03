import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

let mockDb: MockDb

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
})

function passWith(proximitySettings: unknown) {
  return { passTemplate: { organization: { name: "Café Lola", proximitySettings } } }
}

async function load() {
  const { loadPassProximity } = await import("./settings")
  return loadPassProximity("pi-1")
}

describe("loadPassProximity", () => {
  it("returns the business location with its text", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(
      passWith({ enabled: true, latitude: 40.41, longitude: -3.7, message: "¡Pásate!" }),
    )
    expect(await load()).toEqual({ latitude: 40.41, longitude: -3.7, relevantText: "¡Pásate!" })
  })

  it("falls back to the business name when there's no text", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(
      passWith({ enabled: true, latitude: 1, longitude: 2, message: "  " }),
    )
    expect(await load()).toMatchObject({ relevantText: "Café Lola" })
  })

  it("nothing when off or not set up", async () => {
    mockDb.passInstance.findUnique.mockResolvedValue(passWith({ enabled: false, latitude: 1, longitude: 2, message: null }))
    expect(await load()).toBeNull()
    mockDb.passInstance.findUnique.mockResolvedValue(passWith(null))
    expect(await load()).toBeNull()
  })

  it("a lookup failure drops the location instead of failing the pass", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockDb.passInstance.findUnique.mockRejectedValue(new Error("db blip"))
    expect(await load()).toBeNull()
  })
})
