import "server-only"

type GoogleGeocodingResult = {
  results: {
    geometry: {
      location: { lat: number; lng: number }
    }
  }[]
  status: string
}

type NominatimResult = {
  lat: string
  lon: string
}

/**
 * Geocodes an address string to lat/lng coordinates.
 * Uses Google Maps Geocoding API when GOOGLE_MAPS_API_KEY is set,
 * falls back to Nominatim (OpenStreetMap) otherwise.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null

  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
  if (googleApiKey) {
    return geocodeWithGoogle(address, googleApiKey)
  }
  return geocodeWithNominatim(address)
}

async function geocodeWithGoogle(
  address: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
    url.searchParams.set("address", address)
    url.searchParams.set("key", apiKey)

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) return null

    const data = (await response.json()) as GoogleGeocodingResult
    if (data.status !== "OK" || !data.results.length) return null

    const { lat, lng } = data.results[0].geometry.location
    if (isNaN(lat) || isNaN(lng)) return null

    return { lat, lng }
  } catch {
    return null
  }
}

async function geocodeWithNominatim(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", address)
    url.searchParams.set("format", "json")
    url.searchParams.set("limit", "1")

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Loyalshy-LoyaltyCard/1.0 (https://loyalshy.com)",
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
