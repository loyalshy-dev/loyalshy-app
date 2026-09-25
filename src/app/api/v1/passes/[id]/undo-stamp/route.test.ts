import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"

// The global setup stubs next/server; this route needs the real NextRequest.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server")
  return { ...actual }
})

let mockDb: MockDb
const mockDispatch = vi.fn()
const mockLogOrgAction = vi.fn()

beforeEach(() => {
  vi.resetModules()
  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))
  vi.doMock("@/lib/wallet/dispatch", () => ({ dispatchWalletUpdate: mockDispatch }))
  vi.doMock("@/lib/org-audit", () => ({ logOrgAction: mockLogOrgAction }))
  mockDispatch.mockReset()
  mockLogOrgAction.mockReset()

  // sessionHandler: valid session in org-1 as user-1
  mockDb.session.findUnique.mockResolvedValue({
    expiresAt: new Date(Date.now() + 60_000),
    activeOrganizationId: "org-1",
    user: { id: "user-1" },
  })
  mockDb.member.findFirst.mockResolvedValue({ role: "member" })
  mockDb.user.findUnique.mockResolvedValue({ email: "staff@example.com" })

  mockDb.passInstance.findFirst.mockResolvedValue({
    id: "pi-1",
    status: "ACTIVE",
    walletProvider: "APPLE",
    passTemplate: { id: "pt-1", name: "Coffee", passType: "STAMP_CARD", config: { stampsRequired: 8 } },
    contact: { id: "c-1", fullName: "Ana" },
  })
  mockDb.passInstance.findUnique.mockResolvedValue({
    id: "pi-1",
    passTemplate: { id: "pt-1", name: "Coffee", passType: "STAMP_CARD", config: { stampsRequired: 8 } },
    contact: { id: "c-1", fullName: "Ana", email: null },
    rewards: [],
    interactions: [],
    data: {},
    status: "ACTIVE",
    issuedAt: new Date(),
    expiresAt: null,
    createdAt: new Date(),
    walletProvider: "APPLE",
    contactId: "c-1",
    passTemplateId: "pt-1",
  })
  mockDb._tx.$queryRaw.mockResolvedValue([])
  mockDb._tx.interaction.delete.mockResolvedValue({})
  mockDb._tx.passInstance.update.mockResolvedValue({})
  mockDb._tx.contact.update.mockResolvedValue({})
})

function latestStamp(overrides: Record<string, unknown> = {}) {
  return {
    id: "int-1",
    type: "STAMP",
    createdAt: new Date(Date.now() - 60_000),
    performedById: "user-1",
    metadata: { visitNumber: 3 },
    ...overrides,
  }
}

async function callUndo() {
  const { POST } = await import("./route")
  const { NextRequest } = await import("next/server")
  const req = new NextRequest("https://loyalshy.com/api/v1/passes/pi-1/undo-stamp", {
    method: "POST",
    headers: { authorization: "Bearer token" },
  })
  const res = await POST(req, { params: Promise.resolve({ id: "pi-1" }) })
  return { status: res.status, body: await res.json() }
}

describe("POST /passes/[id]/undo-stamp", () => {
  it("removes the latest stamp and decrements the counters", async () => {
    mockDb._tx.interaction.findFirst
      .mockResolvedValueOnce(latestStamp()) // latest on pass
      .mockResolvedValueOnce(null) // contact's previous interaction
    mockDb._tx.passInstance.findUnique.mockResolvedValue({ data: { currentCycleVisits: 3, totalVisits: 9 } })

    const { status } = await callUndo()

    expect(status).toBe(200)
    expect(mockDb._tx.interaction.delete).toHaveBeenCalledWith({ where: { id: "int-1" } })
    expect(mockDb._tx.passInstance.update).toHaveBeenCalledWith({
      where: { id: "pi-1" },
      data: { data: { currentCycleVisits: 2, totalVisits: 8 } },
    })
    expect(mockDb._tx.contact.update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { totalInteractions: { decrement: 1 }, lastInteractionAt: null },
    })
    expect(mockDispatch).toHaveBeenCalledWith("pi-1", "APPLE", "STAMP")
    expect(mockLogOrgAction).toHaveBeenCalledWith(expect.objectContaining({ action: "STAMP_UNDONE", targetId: "pi-1" }))
  })

  it("takes back the card-completing stamp and its unused reward", async () => {
    mockDb._tx.interaction.findFirst
      .mockResolvedValueOnce(latestStamp({ metadata: { visitNumber: 8 } }))
      .mockResolvedValueOnce(null)
    mockDb._tx.passInstance.findUnique.mockResolvedValue({ data: { currentCycleVisits: 0, totalVisits: 16 } })
    mockDb._tx.reward.findFirst.mockResolvedValue({ id: "rw-1", status: "AVAILABLE", revealedAt: new Date(), description: null })
    mockDb._tx.reward.deleteMany.mockResolvedValue({ count: 1 })

    const { status } = await callUndo()

    expect(status).toBe(200)
    expect(mockDb._tx.reward.deleteMany).toHaveBeenCalledWith({ where: { id: "rw-1", status: "AVAILABLE" } })
    expect(mockDb._tx.passInstance.update).toHaveBeenCalledWith({
      where: { id: "pi-1" },
      data: { data: { currentCycleVisits: 7, totalVisits: 15 } },
    })
  })

  it("refuses when the reward from that stamp was already redeemed", async () => {
    mockDb._tx.interaction.findFirst.mockResolvedValueOnce(latestStamp({ metadata: { visitNumber: 8 } }))
    mockDb._tx.passInstance.findUnique.mockResolvedValue({ data: { currentCycleVisits: 0, totalVisits: 16 } })
    mockDb._tx.reward.findFirst.mockResolvedValue({ id: "rw-1", status: "REDEEMED", revealedAt: null, description: null })

    const { status, body } = await callUndo()

    expect(status).toBe(409)
    expect(body.code).toBe("rewardAlreadyUsed")
    expect(mockDb._tx.interaction.delete).not.toHaveBeenCalled()
  })

  it("refuses after the 10-minute window", async () => {
    mockDb._tx.interaction.findFirst.mockResolvedValueOnce(
      latestStamp({ createdAt: new Date(Date.now() - 11 * 60_000) }),
    )
    const { status, body } = await callUndo()
    expect(status).toBe(409)
    expect(body.code).toBe("undoWindowPassed")
  })

  it("refuses when the last action isn't a stamp", async () => {
    mockDb._tx.interaction.findFirst.mockResolvedValueOnce(latestStamp({ type: "NOTE" }))
    const { body } = await callUndo()
    expect(body.code).toBe("nothingToUndo")
  })

  it("stops staff undoing someone else's stamp, but lets a manager", async () => {
    mockDb._tx.interaction.findFirst.mockResolvedValueOnce(latestStamp({ performedById: "user-2" }))
    const denied = await callUndo()
    expect(denied.body.code).toBe("notYourStamp")

    mockDb.member.findFirst.mockResolvedValue({ role: "admin" })
    mockDb._tx.interaction.findFirst
      .mockResolvedValueOnce(latestStamp({ performedById: "user-2" }))
      .mockResolvedValueOnce(null)
    mockDb._tx.passInstance.findUnique.mockResolvedValue({ data: { currentCycleVisits: 3, totalVisits: 9 } })
    const allowed = await callUndo()
    expect(allowed.status).toBe(200)
  })
})
