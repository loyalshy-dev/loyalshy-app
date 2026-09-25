import { NextRequest, after } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  sessionHandler,
  handlePreflight,
  badRequest,
  notFound,
  requireRole,
  ApiError,
} from "@/lib/api-session"
import { orgScope } from "@/lib/org-scope"
import {
  getAnnouncementQuota,
  countProgramSendsLast24h,
  ANNOUNCEMENT_PROGRAM_MAX_PER_24H,
} from "@/lib/announcement-quota"
import { sendAnnouncement, ANNOUNCEMENT_MAX_LENGTH } from "@/lib/announcements"
import { parseTemplateAnnouncement } from "@/lib/pass-config"

export function OPTIONS() {
  return handlePreflight()
}

/**
 * Everything the staff app needs to compose a wallet broadcast: the org's
 * plan quota (shared across programs) and, per ACTIVE program, how many
 * wallet holders it reaches, today's sends vs the per-program cap, and the
 * last message. Owner + Program manager only (same as the dashboard).
 */
export async function GET(req: NextRequest) {
  return sessionHandler(req, async (ctx) => {
    requireRole(ctx, "admin")
    const organization = await db.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { id: true, plan: true, subscriptionStatus: true },
    })
    if (!organization) throw notFound("Organization not found")

    const now = new Date()
    const [quota, templates] = await Promise.all([
      getAnnouncementQuota(db, organization, now),
      db.passTemplate.findMany({
        where: orgScope.passTemplate(ctx, { status: "ACTIVE" }),
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, passType: true, announcement: true },
      }),
    ])

    const programs = await Promise.all(
      templates.map(async (t) => {
        const [recipients, sendsLast24h] = await Promise.all([
          db.passInstance.count({
            where: { passTemplateId: t.id, status: "ACTIVE", walletProvider: { not: "NONE" } },
          }),
          countProgramSendsLast24h(db, t.id, now),
        ])
        const last = parseTemplateAnnouncement(t.announcement)
        return {
          templateId: t.id,
          name: t.name,
          passType: t.passType,
          recipients,
          sendsLast24h,
          lastMessage: last?.message ?? null,
          lastSentAt: last?.sentAt ?? null,
        }
      }),
    )

    return {
      quota: {
        plan: quota.plan,
        period: quota.period,
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining,
        nextAvailableAt: quota.nextAvailableAt,
        inactive: quota.inactive,
      },
      programDailyCap: ANNOUNCEMENT_PROGRAM_MAX_PER_24H,
      maxLength: ANNOUNCEMENT_MAX_LENGTH,
      programs,
    }
  })
}

const sendSchema = z.object({
  templateId: z.string().min(1),
  message: z.string().trim().min(1).max(ANNOUNCEMENT_MAX_LENGTH),
})

/** Send a wallet broadcast to every holder of a program. */
export async function POST(req: NextRequest) {
  return sessionHandler(req, async (ctx) => {
    requireRole(ctx, "admin")
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw badRequest("Invalid JSON body")
    }
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input")

    const organization = await db.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { id: true, name: true, plan: true, subscriptionStatus: true },
    })
    if (!organization) throw notFound("Organization not found")

    const outcome = await sendAnnouncement({
      organization,
      sentById: ctx.userId,
      templateId: parsed.data.templateId,
      message: parsed.data.message,
      // Keep the Lambda alive for the wallet fan-out (see lib/wallet/dispatch.ts)
      schedule: (task) => after(task),
    })

    if (!outcome.ok) {
      if (outcome.code === "templateNotFound") throw notFound("Program not found")
      throw new ApiError(409, "Conflict", outcome.code, {
        code: outcome.code,
        nextAvailableAt: outcome.nextAvailableAt,
      })
    }
    return { recipients: outcome.recipients, remaining: outcome.remaining }
  })
}
