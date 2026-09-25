import "server-only"

import { NextResponse } from "next/server"
import { renderAppleCardStrip } from "./card-view"
import type { PassGenerationInput } from "./generate-pass"

/**
 * PNG response for a card strip. The URL carries a `v` (stripVersion) param
 * that changes whenever the image would, so the image is immutable per URL
 * and the staff app can cache it hard.
 */
export async function stripResponse(input: PassGenerationInput): Promise<Response> {
  const strip = await renderAppleCardStrip(input)
  if (!strip) return new NextResponse(null, { status: 204 })
  if ("redirect" in strip) return NextResponse.redirect(strip.redirect, 302)
  return new NextResponse(new Uint8Array(strip.png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  })
}
