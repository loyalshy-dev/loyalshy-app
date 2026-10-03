import { z } from "zod"

// "Near your business" (Automations). One location per business; iPhone
// only — Apple shows the pass on the lock screen near it. Google Wallet has
// no location alert, so nothing is promised there.

/** Lock-screen text limit. Apple shows one short line; keep it tight. */
export const PROXIMITY_MESSAGE_MAX = 80

export const proximitySettingsSchema = z.object({
  enabled: z.boolean(),
  address: z.string().trim().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  message: z.string().trim().max(PROXIMITY_MESSAGE_MAX),
})

export type ProximitySettingsInput = z.infer<typeof proximitySettingsSchema>
