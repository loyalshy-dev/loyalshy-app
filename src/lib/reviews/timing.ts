// When a review prompt goes out, and how long it counts as "just sent".
// Pure functions (no tz library in the project; Intl gives the wall clock).

/** Wait after the triggering stamp: the ask lands after the visit, not at the counter. */
export const REVIEW_PROMPT_DELAY_MS = 90 * 60 * 1000

/** Local hours [start, end) when a prompt may be delivered. */
const SEND_WINDOW_START_HOUR = 9
const SEND_WINDOW_END_HOUR = 21
/** Where a prompt that would land at night is moved to (local time). */
const DEFERRED_SEND_HOUR = 10

/**
 * How long after `reviewPromptedAt` the pass still carries the notifying
 * version of the prompt (Apple changeMessage / Google TEXT_AND_NOTIFY). After
 * that the field stays but goes quiet, so a later edit of the message can't
 * re-notify everyone who was already asked.
 */
export const REVIEW_PROMPT_FRESH_MS = 24 * 60 * 60 * 1000

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number }

function wallClock(at: Date, timeZone: string): WallClock | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
    const parts = Object.fromEntries(
      fmt.formatToParts(at)
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, Number(p.value)]),
    )
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    }
  } catch {
    return null
  }
}

/** Offset (ms) of the zone's wall clock vs UTC at instant `at`. */
function zoneOffset(at: Date, timeZone: string): number {
  const w = wallClock(at, timeZone)
  if (!w) return 0
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return wallAsUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** UTC instant of a local wall-clock time in `timeZone` (DST-safe). */
function localTimeToUtc(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour)
  // Two passes settle the offset when the guess and the answer straddle a DST change.
  let utc = guess - zoneOffset(new Date(guess), timeZone)
  utc = guess - zoneOffset(new Date(utc), timeZone)
  return new Date(utc)
}

/**
 * When to deliver the prompt for a stamp at `stampAt`: `delayMs` later,
 * pushed to 10:00 local if that lands outside 09:00–21:00 in the org's zone.
 * Unknown zones behave as UTC.
 */
export function computeReviewDueAt(
  stampAt: Date,
  timeZone: string,
  delayMs: number = REVIEW_PROMPT_DELAY_MS,
): Date {
  const candidate = new Date(stampAt.getTime() + delayMs)
  const zone = wallClock(candidate, timeZone) ? timeZone : "UTC"
  const w = wallClock(candidate, zone)
  if (!w) return candidate

  if (w.hour >= SEND_WINDOW_START_HOUR && w.hour < SEND_WINDOW_END_HOUR) return candidate

  if (w.hour < SEND_WINDOW_START_HOUR) {
    return localTimeToUtc(w.year, w.month, w.day, DEFERRED_SEND_HOUR, zone)
  }
  // Evening → tomorrow morning. Date.UTC normalises day overflow (31 → 1st).
  const next = new Date(Date.UTC(w.year, w.month - 1, w.day + 1))
  return localTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), DEFERRED_SEND_HOUR, zone)
}

export function isReviewPromptFresh(promptedAt: Date | null, now: Date = new Date()): boolean {
  if (!promptedAt) return false
  const age = now.getTime() - promptedAt.getTime()
  return age >= 0 && age < REVIEW_PROMPT_FRESH_MS
}
