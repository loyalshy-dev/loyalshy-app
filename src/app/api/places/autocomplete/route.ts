import { NextRequest, NextResponse } from "next/server"

type GooglePlaceSuggestion = {
  placePrediction: {
    placeId: string
    text: { text: string }
    structuredFormat?: {
      mainText: { text: string }
      secondaryText: { text: string }
    }
  }
}

type GooglePlacesResponse = {
  suggestions: GooglePlaceSuggestion[]
}

type GooglePlaceDetails = {
  location: { latitude: number; longitude: number }
  formattedAddress: string
}

type NominatimResult = {
  display_name: string
  lat: string
  lon: string
  place_id: number
}

/**
 * GET /api/places/autocomplete?q=...&placeId=...
 *
 * - q= → returns address suggestions
 * - placeId= → returns lat/lng for a specific place
 *
 * Uses Google Places API (New) when GOOGLE_MAPS_API_KEY is set,
 * falls back to Nominatim (OpenStreetMap) otherwise.
 */
// Referer header so Google accepts server-side requests with HTTP referrer restrictions
const REFERER = process.env.BETTER_AUTH_URL || "https://www.loyalshy.com"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const query = searchParams.get("q")
  const placeId = searchParams.get("placeId")

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY

  // ─── Place details (Google only) ───────────────────
  if (placeId && googleApiKey) {
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          headers: {
            "X-Goog-Api-Key": googleApiKey,
            "X-Goog-FieldMask": "location,formattedAddress",
            "Referer": REFERER,
          },
          signal: AbortSignal.timeout(5000),
        }
      )
      if (!res.ok) {
        return NextResponse.json({ suggestions: [] })
      }
      const data = (await res.json()) as GooglePlaceDetails
      return NextResponse.json({
        lat: data.location.latitude,
        lng: data.location.longitude,
        address: data.formattedAddress,
      })
    } catch {
      return NextResponse.json({ suggestions: [] })
    }
  }

  // ─── Autocomplete suggestions ──────────────────────
  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  if (googleApiKey) {
    return googleAutocomplete(query, googleApiKey)
  }
  return nominatimSearch(query)
}

async function googleAutocomplete(query: string, apiKey: string) {
  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "Referer": REFERER,
        },
        body: JSON.stringify({
          input: query,
          includedPrimaryTypes: ["street_address", "premise", "establishment"],
        }),
        signal: AbortSignal.timeout(5000),
      }
    )

    if (!res.ok) {
      // Google failed (key restriction, quota, etc.) — fall back to Nominatim
      return nominatimSearch(query)
    }

    const data = (await res.json()) as GooglePlacesResponse
    const suggestions = (data.suggestions || []).map((s) => ({
      placeId: s.placePrediction.placeId,
      description: s.placePrediction.text.text,
      mainText: s.placePrediction.structuredFormat?.mainText.text ?? s.placePrediction.text.text,
      secondaryText: s.placePrediction.structuredFormat?.secondaryText.text ?? "",
    }))

    return NextResponse.json({ suggestions })
  } catch {
    // Network error — fall back to Nominatim
    return nominatimSearch(query)
  }
}

async function nominatimSearch(query: string) {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", query)
    url.searchParams.set("format", "json")
    url.searchParams.set("limit", "5")
    url.searchParams.set("addressdetails", "1")

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Loyalshy-LoyaltyCard/1.0 (https://loyalshy.com)",
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] })
    }

    const results = (await res.json()) as NominatimResult[]
    const suggestions = results.map((r) => ({
      placeId: String(r.place_id),
      description: r.display_name,
      mainText: r.display_name.split(",")[0],
      secondaryText: r.display_name.split(",").slice(1).join(",").trim(),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }))

    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ suggestions: [] })
  }
}
