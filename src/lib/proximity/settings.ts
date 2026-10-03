import "server-only"

import { db } from "@/lib/db"

/** The lock-screen relevance an Apple pass carries (pass.json `locations`). */
export type PassProximity = {
  latitude: number
  longitude: number
  /** What iOS shows on the lock screen next to the pass. */
  relevantText: string
}

/**
 * Lock-screen location for one pass: the org's location when "near your
 * business" is on, else null. Best-effort — runs inside every Apple pass
 * generation, so a lookup failure drops the location instead of failing it.
 */
export async function loadPassProximity(passInstanceId: string): Promise<PassProximity | null> {
  try {
    const pass = await db.passInstance.findUnique({
      where: { id: passInstanceId },
      select: {
        passTemplate: {
          select: {
            organization: {
              select: {
                name: true,
                proximitySettings: {
                  select: { enabled: true, latitude: true, longitude: true, message: true },
                },
              },
            },
          },
        },
      },
    })
    const org = pass?.passTemplate.organization
    const settings = org?.proximitySettings
    if (!org || !settings?.enabled) return null
    return {
      latitude: settings.latitude,
      longitude: settings.longitude,
      relevantText: settings.message?.trim() || org.name,
    }
  } catch (err) {
    console.error("[proximity] lookup failed:", err instanceof Error ? err.message : err)
    return null
  }
}
