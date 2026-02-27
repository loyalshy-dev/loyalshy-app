import { NextResponse } from "next/server"

// ── POST: Receive error logs from Apple Wallet ──

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log("[Apple Wallet Log]", JSON.stringify(body, null, 2))
  } catch {
    console.log("[Apple Wallet Log] Failed to parse log body")
  }

  return new NextResponse(null, { status: 200 })
}
