import { vi } from "vitest"

/**
 * Creates a mock Prisma client for testing.
 * Each model gets standard CRUD methods as vi.fn() stubs.
 */
function createMockModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    groupBy: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  }
}

export function createMockDb() {
  const mockTx = {
    interaction: createMockModel(),
    contact: createMockModel(),
    reward: createMockModel(),
    organization: createMockModel(),
    member: createMockModel(),
    staffInvitation: createMockModel(),
    walletPassLog: createMockModel(),
    passTemplate: createMockModel(),
    passInstance: createMockModel(),
    passDesign: createMockModel(),
  }

  return {
    organization: createMockModel(),
    contact: createMockModel(),
    interaction: createMockModel(),
    reward: createMockModel(),
    member: createMockModel(),
    staffInvitation: createMockModel(),
    walletPassLog: createMockModel(),
    passTemplate: createMockModel(),
    passInstance: createMockModel(),
    passDesign: createMockModel(),
    user: createMockModel(),
    analyticsSnapshot: createMockModel(),
    deviceRegistration: createMockModel(),
    webhookEvent: createMockModel(),
    showcaseCard: createMockModel(),
    invitation: createMockModel(),
    session: createMockModel(),
    account: createMockModel(),
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
      return fn(mockTx)
    }),
    $queryRaw: vi.fn(),
    _tx: mockTx,
  }
}

export type MockDb = ReturnType<typeof createMockDb>
