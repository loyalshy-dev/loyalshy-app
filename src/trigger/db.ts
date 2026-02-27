import { PrismaClient } from "@prisma/client"

/**
 * Creates a fresh PrismaClient for Trigger.dev tasks.
 * Each task gets its own client since tasks run in isolated environments.
 * Always call `db.$disconnect()` in a finally block.
 */
export function createDb(): PrismaClient {
  return new PrismaClient()
}
