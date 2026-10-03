import "server-only"

import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { orgAllowsFeature } from "@/lib/plan-access"
import { isReviewEligiblePass } from "@/lib/reviews/eligibility"
import {
  WINBACK_BATCH_LIMIT,
  WINBACK_COOLDOWN_DAYS,
  WINBACK_MIN_VISITS,
} from "./config"
import { isHoldout, isWinbackSendHour } from "./timing"

const DAY_MS = 24 * 60 * 60 * 1000
const PUSH_CONCURRENCY = 5

export type WinbackOrgResult = {
  organizationId: string
  candidates: number
  sent: number
  control: number
  unreachable: number
  failedPushes: number
}

type Candidate = { id: string; lastInteractionAt: Date }

/**
 * Test hook: WINBACK_TEST_INACTIVE_MINUTES=2 treats "inactive" as N minutes
 * instead of the org's days, ignores the 10:00 send hour and the 90-day
 * cooldown — for on-device checks. Never leave it set in production.
 */
function testInactiveMs(): number | null {
  const minutes = Number(process.env.WINBACK_TEST_INACTIVE_MINUTES)
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : null
}

/**
 * One win-back run (hourly, from the Trigger.dev schedule via
 * /api/internal/winback). Handles every org that has it on, may use it, and
 * is at its local send hour.
 */
export async function runWinback(now: Date = new Date()): Promise<WinbackOrgResult[]> {
  const testMs = testInactiveMs()
  const rows = await db.winbackSettings.findMany({
    where: { enabled: true },
    select: {
      organizationId: true,
      inactiveDays: true,
      message: true,
      holdout: true,
      includeExisting: true,
      startedAt: true,
      organization: { select: { plan: true, subscriptionStatus: true, timezone: true } },
    },
  })

  const results: WinbackOrgResult[] = []
  for (const row of rows) {
    if (!testMs && !isWinbackSendHour(now, row.organization.timezone)) continue
    if (!(await orgAllowsFeature({ id: row.organizationId, ...row.organization }, "winback"))) continue
    try {
      results.push(await runForOrganization(row, now, testMs))
    } catch (err) {
      console.error(
        `[winback] run failed for org ${row.organizationId}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
  return results
}

async function runForOrganization(
  settings: {
    organizationId: string
    inactiveDays: number
    message: string
    holdout: boolean
    includeExisting: boolean
    startedAt: Date | null
  },
  now: Date,
  testMs: number | null,
): Promise<WinbackOrgResult> {
  const inactiveMs = testMs ?? settings.inactiveDays * DAY_MS
  const cutoff = new Date(now.getTime() - inactiveMs)
  // "Only from now on": the absence must cross the threshold after the
  // feature was turned on, i.e. the last visit is at most `inactive` before it.
  const floor =
    !settings.includeExisting && settings.startedAt
      ? new Date(settings.startedAt.getTime() - inactiveMs)
      : null
  const cooldownSince = testMs ? now : new Date(now.getTime() - WINBACK_COOLDOWN_DAYS * DAY_MS)

  const candidates = await findCandidates({
    organizationId: settings.organizationId,
    cutoff,
    floor,
    cooldownSince,
  })

  const result: WinbackOrgResult = {
    organizationId: settings.organizationId,
    candidates: candidates.length,
    sent: 0,
    control: 0,
    unreachable: 0,
    failedPushes: 0,
  }

  const pushes: { passInstanceId: string; walletProvider: "APPLE" | "GOOGLE" }[] = []
  for (const contact of candidates) {
    const pass = await pickPass(contact.id)
    const control = Boolean(pass) && settings.holdout && isHoldout(contact.id, contact.lastInteractionAt)
    try {
      await db.winbackSend.create({
        data: {
          organizationId: settings.organizationId,
          contactId: contact.id,
          passInstanceId: pass?.id ?? null,
          lapseKey: contact.lastInteractionAt,
          control,
          reachable: Boolean(pass),
          message: settings.message,
          sentAt: now,
        },
      })
    } catch (err) {
      // Same absence already handled by an overlapping run.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue
      throw err
    }
    if (!pass) result.unreachable++
    else if (control) result.control++
    else pushes.push({ passInstanceId: pass.id, walletProvider: pass.walletProvider })
  }

  // The pass refresh reads the new WinbackSend row (pass-field.ts), so the
  // push is all it takes to show the message.
  for (let i = 0; i < pushes.length; i += PUSH_CONCURRENCY) {
    const outcomes = await Promise.allSettled(pushes.slice(i, i + PUSH_CONCURRENCY).map(notify))
    for (const o of outcomes) {
      if (o.status === "fulfilled") result.sent++
      else {
        result.failedPushes++
        console.error("[winback] push failed:", o.reason instanceof Error ? o.reason.message : o.reason)
      }
    }
  }
  return result
}

/**
 * Regulars whose last visit is older than the cutoff and whose current
 * absence hasn't been handled (lapseKey = lastInteractionAt), outside the
 * cooldown. Raw SQL because "this absence" compares two columns, which a
 * Prisma filter can't express.
 */
export type CandidateFilter = {
  organizationId: string
  cutoff: Date
  floor: Date | null
  cooldownSince: Date
}

/** Exported for the SQL check in tests; the run and the counter both use it. */
export function candidateWhere(args: CandidateFilter): Prisma.Sql {
  const floorClause = args.floor ? Prisma.sql`AND c."lastInteractionAt" >= ${args.floor}` : Prisma.empty
  return Prisma.sql`
    c."organizationId" = ${args.organizationId}
      AND c."deletedAt" IS NULL
      AND c."totalInteractions" >= ${WINBACK_MIN_VISITS}
      AND c."lastInteractionAt" IS NOT NULL
      AND c."lastInteractionAt" <= ${args.cutoff}
      ${floorClause}
      AND NOT EXISTS (
        SELECT 1 FROM winback_send w
        WHERE w."contactId" = c.id
          AND (w."lapseKey" = c."lastInteractionAt" OR w."sentAt" >= ${args.cooldownSince})
      )`
}

async function findCandidates(args: CandidateFilter): Promise<Candidate[]> {
  return db.$queryRaw<Candidate[]>`
    SELECT c.id, c."lastInteractionAt"
    FROM contact c
    WHERE ${candidateWhere(args)}
    ORDER BY c."lastInteractionAt" DESC
    LIMIT ${WINBACK_BATCH_LIMIT}
  `
}

/**
 * Settings-page counter: how many customers qualify right now for these
 * settings (same rules as the run), and how many of them still have a pass
 * in a wallet. `fromNowOn` mirrors includeExisting=false for an org that is
 * turning it on now — nobody qualifies on day one.
 */
export async function countWinbackCandidates(args: {
  organizationId: string
  inactiveDays: number
  startedAt: Date | null
  includeExisting: boolean
  now?: Date
}): Promise<{ eligible: number; reachable: number }> {
  const now = args.now ?? new Date()
  const inactiveMs = args.inactiveDays * DAY_MS
  const filter: CandidateFilter = {
    organizationId: args.organizationId,
    cutoff: new Date(now.getTime() - inactiveMs),
    floor: args.includeExisting ? null : new Date((args.startedAt ?? now).getTime() - inactiveMs),
    cooldownSince: new Date(now.getTime() - WINBACK_COOLDOWN_DAYS * DAY_MS),
  }
  const rows = await db.$queryRaw<{ eligible: bigint; reachable: bigint }[]>`
    SELECT
      COUNT(*) AS eligible,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM pass_instance p
        WHERE p."contactId" = c.id
          AND p.status = 'active'
          AND p."walletProvider" IN ('apple', 'google')
      )) AS reachable
    FROM contact c
    WHERE ${candidateWhere(filter)}
  `
  return { eligible: Number(rows[0]?.eligible ?? 0), reachable: Number(rows[0]?.reachable ?? 0) }
}

/** The contact's most recently used pass that can carry the message. */
async function pickPass(
  contactId: string,
): Promise<{ id: string; walletProvider: "APPLE" | "GOOGLE" } | null> {
  const recent = await db.interaction.findMany({
    where: {
      contactId,
      passInstance: { status: "ACTIVE", walletProvider: { in: ["APPLE", "GOOGLE"] } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      passInstance: {
        select: {
          id: true,
          walletProvider: true,
          passTemplate: { select: { passType: true, config: true } },
        },
      },
    },
  })
  for (const { passInstance: pi } of recent) {
    if (!pi || (pi.walletProvider !== "APPLE" && pi.walletProvider !== "GOOGLE")) continue
    if (isReviewEligiblePass(pi.passTemplate.passType, pi.passTemplate.config)) {
      return { id: pi.id, walletProvider: pi.walletProvider }
    }
  }
  return null
}

async function notify(p: { passInstanceId: string; walletProvider: "APPLE" | "GOOGLE" }) {
  if (p.walletProvider === "APPLE") {
    const { notifyApplePassUpdate } = await import("@/lib/wallet/apple/update-pass")
    await notifyApplePassUpdate(p.passInstanceId)
  } else {
    const { notifyGooglePassUpdate } = await import("@/lib/wallet/google/update-pass")
    await notifyGooglePassUpdate(p.passInstanceId)
  }
}
