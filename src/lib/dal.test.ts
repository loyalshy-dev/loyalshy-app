import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDb, type MockDb } from "@/__tests__/mocks/db"
import { createMockSession } from "@/__tests__/mocks/auth"
import { RedirectError } from "@/__tests__/setup"

// ─── Module mocks ─────────────────────────────────────────────

let mockDb: MockDb
const mockGetSession = vi.fn()

beforeEach(() => {
  vi.resetModules()

  mockDb = createMockDb()
  vi.doMock("@/lib/db", () => ({ db: mockDb }))

  vi.doMock("@/lib/auth", () => ({
    auth: {
      api: {
        getSession: mockGetSession,
      },
    },
  }))

  mockGetSession.mockReset()
})

// ─── Tests ─────────────────────────────────────────────────────

describe("assertAuthenticated", () => {
  it("returns session when authenticated", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    const { assertAuthenticated } = await import("./dal")
    const result = await assertAuthenticated()

    expect(result.user.id).toBe("user-1")
    expect(result.user.email).toBe("test@example.com")
  })

  it("redirects to /login when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null)

    const { assertAuthenticated } = await import("./dal")

    await expect(assertAuthenticated()).rejects.toThrow(RedirectError)
    await expect(assertAuthenticated()).rejects.toThrow("NEXT_REDIRECT: /login")
  })
})

describe("assertSuperAdmin", () => {
  it("returns session for super admin", async () => {
    const session = createMockSession({ role: "SUPER_ADMIN" })
    mockGetSession.mockResolvedValue(session)

    const { assertSuperAdmin } = await import("./dal")
    const result = await assertSuperAdmin()

    expect(result.user.role).toBe("SUPER_ADMIN")
  })

  it("redirects regular users to /dashboard", async () => {
    const session = createMockSession({ role: "USER" })
    mockGetSession.mockResolvedValue(session)

    const { assertSuperAdmin } = await import("./dal")

    await expect(assertSuperAdmin()).rejects.toThrow(RedirectError)
    await expect(assertSuperAdmin()).rejects.toThrow("/dashboard")
  })
})

describe("assertOrganizationAccess", () => {
  it("allows super admin to access any organization", async () => {
    const session = createMockSession({ role: "SUPER_ADMIN" })
    mockGetSession.mockResolvedValue(session)

    const { assertOrganizationAccess } = await import("./dal")
    const result = await assertOrganizationAccess("any-org-id")

    expect(result.member.role).toBe("owner")
    expect(mockDb.member.findFirst).not.toHaveBeenCalled()
  })

  it("allows org member to access their organization", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    mockDb.member.findFirst.mockResolvedValue({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "member",
      createdAt: new Date(),
    })

    const { assertOrganizationAccess } = await import("./dal")
    const result = await assertOrganizationAccess("org-1")

    expect(result.member.role).toBe("member")
  })

  it("redirects when user is not a member", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    mockDb.member.findFirst.mockResolvedValue(null)

    const { assertOrganizationAccess } = await import("./dal")

    await expect(assertOrganizationAccess("org-1")).rejects.toThrow(RedirectError)
  })
})

describe("assertOrganizationRole", () => {
  it("allows owner when owner is required", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    mockDb.member.findFirst.mockResolvedValue({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "owner",
      createdAt: new Date(),
    })

    const { assertOrganizationRole } = await import("./dal")
    const result = await assertOrganizationRole("org-1", "owner")

    expect(result.member.role).toBe("owner")
  })

  it("allows owner when member role is required (hierarchy)", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    mockDb.member.findFirst.mockResolvedValue({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "owner",
      createdAt: new Date(),
    })

    const { assertOrganizationRole } = await import("./dal")
    const result = await assertOrganizationRole("org-1", "member")

    expect(result.member.role).toBe("owner")
  })

  it("rejects member when owner is required", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    mockDb.member.findFirst.mockResolvedValue({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "member",
      createdAt: new Date(),
    })

    const { assertOrganizationRole } = await import("./dal")

    await expect(assertOrganizationRole("org-1", "owner")).rejects.toThrow(
      RedirectError
    )
  })
})

describe("getOrganizationForUser", () => {
  it("returns organization with active pass templates", async () => {
    const session = createMockSession()
    mockGetSession.mockResolvedValue(session)

    const mockOrg = {
      id: "org-1",
      name: "Test",
      passTemplates: [{ id: "tmpl-1", status: "ACTIVE", passDesign: null }],
    }
    mockDb.member.findFirst.mockResolvedValue({ organizationId: "org-1" })
    mockDb.organization.findUnique.mockResolvedValue(mockOrg)

    const { getOrganizationForUser } = await import("./dal")
    const result = await getOrganizationForUser()

    expect(result).toEqual(mockOrg)
  })

  it("returns null when user has no organization membership", async () => {
    const session = createMockSession()
    // No activeOrganizationId in session
    session.session.activeOrganizationId = null
    mockGetSession.mockResolvedValue(session)

    mockDb.member.findFirst.mockResolvedValue(null)

    const { getOrganizationForUser } = await import("./dal")
    const result = await getOrganizationForUser()

    expect(result).toBeNull()
  })
})
