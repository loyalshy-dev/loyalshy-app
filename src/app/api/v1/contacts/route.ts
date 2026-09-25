import { NextRequest, after } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { sessionHandler, handlePreflight, badRequest, notFound, ApiError } from "@/lib/api-session"
import { orgScope } from "@/lib/org-scope"
import { toApiContact } from "@/lib/api-serializers"
import { sanitizeText } from "@/lib/sanitize"
import { getPlanLimits, isActiveSubscription, type PlanId } from "@/lib/plans"
import { createPassInstanceForContact, findOrCreateContact, sendPassIssuedEmail } from "@/lib/issue-pass"

export function OPTIONS() {
  return handlePreflight()
}

export async function GET(req: NextRequest) {
  return sessionHandler(req, async (ctx) => {
    const url = new URL(req.url)
    const search = url.searchParams.get("search")?.trim() ?? ""
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20) || 20))

    const where = orgScope.contact(ctx, {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    })

    const [contacts, total] = await Promise.all([
      db.contact.findMany({
        where,
        orderBy: { lastInteractionAt: { sort: "desc", nulls: "last" } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { passInstances: true } } },
      }),
      db.contact.count({ where }),
    ])

    return { data: contacts.map(toApiContact), pagination: { page, pageSize, total } }
  })
}

const signupSchema = z.object({
  templateId: z.string().min(1),
  fullName: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
})

/**
 * Counter signup: register a customer (or reuse the existing contact with
 * that email / phone) and issue them the program's pass, emailed with
 * Add-to-Wallet links. Open to every role — it's the same outcome as the
 * public /join page, just typed by staff for customers who'd rather not scan.
 *
 * 409 codes: `alreadyHasPass` (with `passInstanceId`), `contactLimit`,
 * `subscriptionInactive`.
 */
export async function POST(req: NextRequest) {
  return sessionHandler(req, async (ctx) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw badRequest("Invalid JSON body")
    }
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input")

    const fullName = sanitizeText(parsed.data.fullName, 100)
    const email = parsed.data.email ? sanitizeText(parsed.data.email, 255) || null : null
    const phone = parsed.data.phone ? sanitizeText(parsed.data.phone, 30) || null : null
    if (!fullName) throw badRequest("Name is required")

    const [organization, template] = await Promise.all([
      db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { id: true, name: true, slug: true, plan: true, subscriptionStatus: true },
      }),
      db.passTemplate.findFirst({
        where: orgScope.passTemplate(ctx, { id: parsed.data.templateId, status: "ACTIVE" }),
        select: { id: true, name: true, passType: true, config: true },
      }),
    ])
    if (!organization) throw notFound("Organization not found")
    if (!template) throw notFound("Program not found")

    if (!isActiveSubscription(organization.subscriptionStatus)) {
      throw new ApiError(409, "Conflict", "subscriptionInactive", { code: "subscriptionInactive" })
    }

    const { contact, created } = await (async () => {
      // Plan contact limit only matters when we'd create a new contact.
      const existing =
        (email ? await db.contact.findFirst({ where: orgScope.contact(ctx, { email, deletedAt: null }), select: { id: true } }) : null) ??
        (phone ? await db.contact.findFirst({ where: orgScope.contact(ctx, { phone, deletedAt: null }), select: { id: true } }) : null)
      if (!existing) {
        const { customerLimit } = getPlanLimits(organization.plan as PlanId)
        const current = await db.contact.count({ where: orgScope.contact(ctx, { deletedAt: null }) })
        if (current >= customerLimit) {
          throw new ApiError(409, "Conflict", "contactLimit", { code: "contactLimit", limit: customerLimit })
        }
      }
      return findOrCreateContact({ organizationId: organization.id, fullName, email, phone })
    })()

    const issued = await createPassInstanceForContact({
      organizationId: organization.id,
      template,
      contactId: contact.id,
    })
    if (issued.status === "already_exists") {
      const existingPass = await db.passInstance.findFirst({
        where: orgScope.passInstance(ctx, { contactId: contact.id, passTemplateId: template.id }),
        select: { id: true },
      })
      throw new ApiError(409, "Conflict", "alreadyHasPass", {
        code: "alreadyHasPass",
        passInstanceId: existingPass?.id ?? null,
        contactId: contact.id,
      })
    }

    // Generating the Apple pass for the email takes a moment — do it after
    // responding (after() keeps the Lambda alive until it's done).
    const emailTo = contact.email
    if (emailTo) {
      after(() =>
        sendPassIssuedEmail({
          passInstanceId: issued.id,
          contact: { fullName: contact.fullName, email: emailTo },
          organization,
          template,
        }).then(() => undefined),
      )
    }

    return {
      contactId: contact.id,
      contactName: contact.fullName,
      memberNumber: contact.memberNumber,
      contactCreated: created,
      passInstanceId: issued.id,
      emailQueued: !!emailTo,
    }
  })
}

