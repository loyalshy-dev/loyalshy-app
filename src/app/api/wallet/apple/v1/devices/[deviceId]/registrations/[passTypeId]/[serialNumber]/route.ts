import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateApplePassAuth } from "@/lib/wallet/apple/auth"

type Params = Promise<{
  deviceId: string
  passTypeId: string
  serialNumber: string
}>

// ── POST: Register device for push notifications ──

export async function POST(request: Request, { params }: { params: Params }) {
  const { deviceId, serialNumber } = await params

  const { valid } = await validateApplePassAuth(request, serialNumber)
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let pushToken = ""
  try {
    const body = await request.json()
    pushToken = body.pushToken ?? ""
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  // Check if registration already exists
  const existing = await db.deviceRegistration.findUnique({
    where: {
      deviceLibraryIdentifier_serialNumber: {
        deviceLibraryIdentifier: deviceId,
        serialNumber,
      },
    },
  })

  if (existing) {
    // Update push token if changed
    if (existing.pushToken !== pushToken) {
      await db.deviceRegistration.update({
        where: { id: existing.id },
        data: { pushToken },
      })
    }
    // 200 = already registered (possibly updated token)
    return new NextResponse(null, { status: 200 })
  }

  // Create new registration
  // DeviceRegistration.serialNumber FK now points to PassInstance.walletPassSerialNumber
  await db.deviceRegistration.create({
    data: {
      deviceLibraryIdentifier: deviceId,
      pushToken,
      serialNumber,
    },
  })

  // 201 = newly registered
  return new NextResponse(null, { status: 201 })
}

// ── DELETE: Unregister device ──

export async function DELETE(
  request: Request,
  { params }: { params: Params }
) {
  const { deviceId, serialNumber } = await params

  const { valid } = await validateApplePassAuth(request, serialNumber)
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await db.deviceRegistration
    .delete({
      where: {
        deviceLibraryIdentifier_serialNumber: {
          deviceLibraryIdentifier: deviceId,
          serialNumber,
        },
      },
    })
    .catch(() => {
      // Already deleted or never existed — that's fine
    })

  return new NextResponse(null, { status: 200 })
}
