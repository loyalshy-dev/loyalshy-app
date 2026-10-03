import "server-only"

import { db } from "@/lib/db"

export type ProximityDashboardData = {
  settings: {
    enabled: boolean
    address: string
    latitude: number
    longitude: number
    message: string | null
  } | null
}

export async function getProximityDashboard(organizationId: string): Promise<ProximityDashboardData> {
  const settings = await db.proximitySettings.findUnique({
    where: { organizationId },
    select: { enabled: true, address: true, latitude: true, longitude: true, message: true },
  })
  return { settings }
}
