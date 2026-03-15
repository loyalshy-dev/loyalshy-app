import { NextResponse } from "next/server"

// ── POST: Receive error logs from Apple Wallet ──

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const entries = Array.isArray(body) ? body : [body]
    console.log(`[Apple Wallet Log] Received ${entries.length} log entr${entries.length === 1 ? "y" : "ies"}`)
  } catch {
    console.log("[Apple Wallet Log] Failed to parse log body")
  }

  return new NextResponse(null, { status: 200 })
}
