import "server-only"

type NominatimResult = {
  lat: string
  lon: string
}

/**
 * Geocodes an address string to lat/lng coordinates using Nominatim (OpenStreetMap).
 * Free service — no API key required. Returns null on any failure.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", address)
    url.searchParams.set("format", "json")
    url.searchParams.set("limit", "1")

    const response = await fetch(url.toString(), {
      headers: {
        // Required by Nominatim usage policy
        "User-Agent": "Fidelio-LoyaltyCard/1.0 (https://fidelio.app)",
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) return null

    const results = (await response.json()) as NominatimResult[]
    if (!results.length) return null

    const lat = parseFloat(results[0].lat)
    const lng = parseFloat(results[0].lon)

    if (isNaN(lat) || isNaN(lng)) return null

    return { lat, lng }
  } catch {
    return null
  }
}
