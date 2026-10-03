// Pure win-back results math (client + server): messaged vs comparison group.

/** A customer "came back" if they visit within this many days of the send. */
export const WINBACK_RETURN_WINDOW_DAYS = 14
/** Below this many customers per group, the lift is too noisy to show. */
export const WINBACK_MIN_GROUP = 20

export type WinbackGroup = { sent: number; back: number }

export type WinbackResults = {
  periodDays: number
  /** Got the message; sends at least 14 days old (outcome known). */
  messaged: WinbackGroup
  /** Held back, no message; same maturity rule. */
  comparison: WinbackGroup
  /** Sends from the last 14 days whose outcome isn't known yet. */
  measuring: number
  /** Inactive customers with no wallet pass to message, in the period. */
  unreachable: number
  rateMessaged: number | null
  rateComparison: number | null
  /** Customers who came back because of the message: (rateM − rateC) × messaged. Null when not measurable. */
  extraCustomers: number | null
}

const rate = (g: WinbackGroup) => (g.sent > 0 ? g.back / g.sent : null)

export function computeWinbackResults(args: {
  periodDays: number
  messaged: WinbackGroup
  comparison: WinbackGroup
  measuring: number
  unreachable: number
}): WinbackResults {
  const rateMessaged = rate(args.messaged)
  const rateComparison = rate(args.comparison)
  const measurable =
    rateMessaged !== null &&
    rateComparison !== null &&
    args.messaged.sent >= WINBACK_MIN_GROUP &&
    args.comparison.sent >= WINBACK_MIN_GROUP
  return {
    ...args,
    rateMessaged,
    rateComparison,
    extraCustomers: measurable ? Math.round((rateMessaged - rateComparison) * args.messaged.sent) : null,
  }
}
