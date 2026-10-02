import { z } from "zod"

// Shared (client + server) win-back rules. Message only: the org writes it,
// Loyalshy never attaches a reward.

export const WINBACK_DAY_OPTIONS = [14, 30, 60, 90] as const
export type WinbackDays = (typeof WINBACK_DAY_OPTIONS)[number]
export const WINBACK_DAYS_DEFAULT: WinbackDays = 30
export const WINBACK_MESSAGE_MAX = 120

/** Only regulars: one-off visitors (tourists) are never messaged. */
export const WINBACK_MIN_VISITS = 2
/** At most one message per customer in this window, however long they stay away. */
export const WINBACK_COOLDOWN_DAYS = 90
/** Share of eligible customers held back (no message) to measure the lift. */
export const WINBACK_HOLDOUT_PERCENT = 10
/** Max customers handled per org per run; the rest go on the next day's run. */
export const WINBACK_BATCH_LIMIT = 300

export const winbackSettingsSchema = z.object({
  enabled: z.boolean(),
  inactiveDays: z.union([z.literal(14), z.literal(30), z.literal(60), z.literal(90)]),
  message: z.string().trim().min(1).max(WINBACK_MESSAGE_MAX),
  holdout: z.boolean(),
  includeExisting: z.boolean(),
})

export type WinbackSettingsInput = z.infer<typeof winbackSettingsSchema>
