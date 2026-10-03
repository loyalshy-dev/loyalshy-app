import { z } from "zod"

// Shared (client + server) rules for the Google review prompt. The prompt is
// an ASK that rides along with a normal stamp — never a reward for reviewing
// (Google bans incentivised reviews and review gating), so there is no
// "bonus stamp" or rating pre-filter option anywhere.

export const REVIEW_MESSAGE_MAX = 120
export const REVIEW_LINK_LABEL_MAX = 40
export const REVIEW_TRIGGER_MIN = 1
export const REVIEW_TRIGGER_MAX = 20
export const REVIEW_TRIGGER_DEFAULT = 3

// Hosts a review link may point at. The /r/{token} redirect only ever sends
// people to one of these, so a pasted link can't turn loyalshy.com into an
// open redirect.
const REVIEW_URL_HOSTS = new Set([
  "search.google.com",
  "www.google.com",
  "google.com",
  "maps.google.com",
  "g.page",
  "maps.app.goo.gl",
  "goo.gl",
])

export function isAllowedReviewUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && REVIEW_URL_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

/** Google's own "write a review" deep link for a Place ID. */
export function buildPlaceReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
}

export const reviewSettingsSchema = z
  .object({
    enabled: z.boolean(),
    placeId: z.string().trim().min(1).max(300).nullable(),
    placeName: z.string().trim().max(200).nullable(),
    // Only used when no placeId was picked (merchant pasted their own link).
    customUrl: z.string().trim().max(500).nullable(),
    triggerStamp: z.number().int().min(REVIEW_TRIGGER_MIN).max(REVIEW_TRIGGER_MAX),
    message: z.string().trim().min(1).max(REVIEW_MESSAGE_MAX),
    linkLabel: z.string().trim().min(1).max(REVIEW_LINK_LABEL_MAX),
  })
  .superRefine((v, ctx) => {
    if (v.placeId) return
    if (!v.customUrl) {
      ctx.addIssue({ code: "custom", path: ["placeId"], message: "missingTarget" })
    } else if (!isAllowedReviewUrl(v.customUrl)) {
      ctx.addIssue({ code: "custom", path: ["customUrl"], message: "invalidUrl" })
    }
  })

export type ReviewSettingsInput = z.infer<typeof reviewSettingsSchema>

/** The review URL a validated settings input resolves to. */
export function resolveReviewUrl(input: Pick<ReviewSettingsInput, "placeId" | "customUrl">): string {
  if (input.placeId) return buildPlaceReviewUrl(input.placeId)
  return input.customUrl ?? ""
}
