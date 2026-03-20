import { NextRequest, NextResponse } from "next/server"

/**
 * Proxies external images (R2) through same-origin to avoid CORS issues
 * when html-to-image captures the card DOM for PNG export.
 *
 * Only allows fetching from the configured R2_PUBLIC_URL domain.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  // Allowlist: only proxy R2 images
  const r2PublicUrl = process.env.R2_PUBLIC_URL
  if (!r2PublicUrl || !url.startsWith(r2PublicUrl)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 })
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return NextResponse.json({ error: "Upstream fetch failed" }, { status: response.status })
    }

    const contentType = response.headers.get("content-type") ?? "image/png"
    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 })
  }
}
