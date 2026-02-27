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
  }
}

export function createMockDb() {
  const mockTx = {
    visit: createMockModel(),
    customer: createMockModel(),
    reward: createMockModel(),
    restaurant: createMockModel(),
    member: createMockModel(),
    organization: createMockModel(),
    staffInvitation: createMockModel(),
    walletPassLog: createMockModel(),
    loyaltyProgram: createMockModel(),
    enrollment: createMockModel(),
  }

  return {
    restaurant: createMockModel(),
    customer: createMockModel(),
    visit: createMockModel(),
    reward: createMockModel(),
    member: createMockModel(),
    organization: createMockModel(),
    staffInvitation: createMockModel(),
    walletPassLog: createMockModel(),
    loyaltyProgram: createMockModel(),
    enrollment: createMockModel(),
    user: createMockModel(),
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
      return fn(mockTx)
    }),
    $queryRaw: vi.fn(),
    _tx: mockTx,
  }
}

export type MockDb = ReturnType<typeof createMockDb>
