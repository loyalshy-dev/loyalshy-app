import { createHash } from "crypto"
import { WINBACK_HOLDOUT_PERCENT } from "./config"

/** Local hour when the day's win-back messages go out (org time zone). */
export const WINBACK_SEND_HOUR = 10

/** How long the pass carries the notifying version after a send. */
export const WINBACK_FRESH_MS = 24 * 60 * 60 * 1000

/** Current hour (0–23) in `timeZone`; unknown zones behave as UTC. */
export function localHour(now: Date, timeZone: string): number {
  try {
    const hour = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .find((p) => p.type === "hour")?.value
    return Number(hour)
  } catch {
    return now.getUTCHours()
  }
}

export function isWinbackSendHour(now: Date, timeZone: string): boolean {
  return localHour(now, timeZone) === WINBACK_SEND_HOUR
}

/**
 * Deterministic comparison-group draw for one absence: the same contact and
 * absence always land in the same group (retries, overlapping runs), and a
 * new absence is a fresh draw.
 */
export function isHoldout(contactId: string, lapseKey: Date): boolean {
  const digest = createHash("sha256").update(`${contactId}:${lapseKey.toISOString()}`).digest()
  return digest.readUInt32BE(0) % 100 < WINBACK_HOLDOUT_PERCENT
}

export function isWinbackFresh(sentAt: Date, now: Date = new Date()): boolean {
  const age = now.getTime() - sentAt.getTime()
  return age >= 0 && age < WINBACK_FRESH_MS
}
