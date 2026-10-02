import "server-only"

// Google Places API (New) calls for the review prompt: finding the business
// (to get its Place ID) and reading its public rating + review count.
// Uses GOOGLE_MAPS_API_KEY, the same key as the address autocomplete; the
// key has HTTP referrer restrictions, hence the Referer header.

const PLACES_BASE = "https://places.googleapis.com/v1"
const REFERER = process.env.BETTER_AUTH_URL || "https://loyalshy.com"

export type BusinessSuggestion = {
  placeId: string
  name: string
  address: string
}

export type PlaceRating = {
  name: string | null
  address: string | null
  rating: number | null
  ratingCount: number
}

type AutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId: string
      text: { text: string }
      structuredFormat?: { mainText: { text: string }; secondaryText?: { text: string } }
    }
  }[]
}

type DetailsResponse = {
  displayName?: { text: string }
  formattedAddress?: string
  rating?: number
  userRatingCount?: number
}

export function isPlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY)
}

/** Businesses (establishments) matching `query`. Empty on any failure. */
export async function searchBusinesses(query: string, languageCode: string): Promise<BusinessSuggestion[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key || query.trim().length < 2) return []
  try {
    const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, Referer: REFERER },
      body: JSON.stringify({ input: query.trim(), includedPrimaryTypes: ["establishment"], languageCode }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as AutocompleteResponse
    return (data.suggestions ?? [])
      .flatMap((s) => (s.placePrediction ? [s.placePrediction] : []))
      .slice(0, 5)
      .map((p) => ({
        placeId: p.placeId,
        name: p.structuredFormat?.mainText.text ?? p.text.text,
        address: p.structuredFormat?.secondaryText?.text ?? "",
      }))
  } catch {
    return []
  }
}

/**
 * Public rating + review count for a Place ID. Null when the place can't be
 * read (bad id, key/quota problem) — callers skip that day's snapshot.
 * rating/userRatingCount are Place Details "Enterprise" fields (billed per call).
 */
export async function fetchPlaceRating(placeId: string): Promise<PlaceRating | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "displayName,formattedAddress,rating,userRatingCount",
        Referer: REFERER,
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as DetailsResponse
    return {
      name: data.displayName?.text ?? null,
      address: data.formattedAddress ?? null,
      rating: typeof data.rating === "number" ? data.rating : null,
      ratingCount: typeof data.userRatingCount === "number" ? data.userRatingCount : 0,
    }
  } catch {
    return null
  }
}
