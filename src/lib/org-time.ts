/**
 * Start of "today" in an IANA time zone, as a UTC instant — so a café in
 * Madrid gets its own midnight, not UTC's. Falls back to UTC for unknown
 * zones. (No tz library in the project; Intl gives us the wall-clock parts.)
 */
export function startOfDayInTimeZone(now: Date, timeZone: string): Date {
  let parts: Record<string, number>
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
    parts = Object.fromEntries(
      fmt.formatToParts(now)
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, Number(p.value)]),
    )
  } catch {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  }
  // Offset between the zone's wall clock and UTC at `now`, in ms.
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  const offset = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - offset)
}
