import { NextResponse } from "next/server"
import { db } from "@/lib/db"

type Params = Promise<{
  deviceId: string
  passTypeId: string
}>

// ── GET: List serial numbers updated since a given timestamp ──

export async function GET(request: Request, { params }: { params: Params }) {
  const { deviceId } = await params
  const url = new URL(request.url)
  const passesUpdatedSince = url.searchParams.get("passesUpdatedSince")

  // Find all registrations for this device
  const registrations = await db.deviceRegistration.findMany({
    where: { deviceLibraryIdentifier: deviceId },
    select: { serialNumber: true },
  })

  if (registrations.length === 0) {
    return new NextResponse(null, { status: 204 })
  }

  const serialNumbers = registrations.map((r: { serialNumber: string }) => r.serialNumber)

  // Filter by update time if passesUpdatedSince is provided
  // Query Enrollment instead of Customer — walletPassSerialNumber lives on Enrollment
  const sinceDate = passesUpdatedSince
    ? new Date(passesUpdatedSince)
    : new Date(0)

  const updatedEnrollments = await db.enrollment.findMany({
    where: {
      walletPassSerialNumber: { in: serialNumbers },
      updatedAt: { gt: sinceDate },
    },
    select: { walletPassSerialNumber: true, updatedAt: true },
  })

  if (updatedEnrollments.length === 0) {
    return new NextResponse(null, { status: 204 })
  }

  // Find the most recent updatedAt
  const lastUpdated = updatedEnrollments.reduce((latest: Date, e: { updatedAt: Date }) => {
    return e.updatedAt > latest ? e.updatedAt : latest
  }, new Date(0))

  return NextResponse.json({
    serialNumbers: updatedEnrollments
      .map((e: { walletPassSerialNumber: string | null }) => e.walletPassSerialNumber)
      .filter(Boolean),
    lastUpdated: lastUpdated.toISOString(),
  })
}
