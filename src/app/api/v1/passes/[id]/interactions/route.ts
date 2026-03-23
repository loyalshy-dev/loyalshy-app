import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { interactionListParamsSchema, createInteractionBodySchema } from "@/lib/api-schemas"
import {
  queryPassInteractions,
  queryPassInstanceDetail,
  performStamp,
  performCouponRedeem,
  performCheckIn,
  performEarnPoints,
  performRedeemPoints,
  performGiftCardCharge,
  performGiftCardRefund,
  performTicketScan,
  performTicketVoid,
  type ActionResult,
} from "@/lib/api-data"
import { serializeInteraction } from "@/lib/api-serializers"
import { apiPaginated, apiCreated } from "@/lib/api-response"
import { ValidationError, NotFoundError, UnprocessableError } from "@/lib/api-errors"
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import type { ApiContext } from "@/lib/api-auth"

// Interaction types that map to domain action functions
const DOMAIN_INTERACTION_TYPES = new Set([
  "STAMP",
  "COUPON_REDEEM",
  "CHECK_IN",
  "POINTS_EARN",
  "POINTS_REDEEM",
  "GIFT_CHARGE",
  "GIFT_REFUND",
  "TICKET_SCAN",
  "TICKET_VOID",
])

// Log-only interaction types (no domain side effects)
const LOG_ONLY_INTERACTION_TYPES = new Set([
  "STATUS_CHANGE",
  "REWARD_EARNED",
  "REWARD_REDEEMED",
  "NOTE",
])

export const OPTIONS = handlePreflight

// GET /api/v1/passes/:passId/interactions — List interactions for a pass
export const GET = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const segments = req.nextUrl.pathname.split("/")
  // /api/v1/passes/[id]/interactions → id is at index -2
  const passId = segments[segments.length - 2]!

  // Verify pass belongs to org
  const pass = await queryPassInstanceDetail(ctx.organizationId, passId)
  if (!pass) {
    throw new NotFoundError(`Pass instance with ID ${passId} was not found.`)
  }

  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = interactionListParamsSchema.safeParse(params)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const { page, per_page, type } = parsed.data
  const result = await queryPassInteractions(ctx.organizationId, passId, {
    page,
    perPage: per_page,
    type,
  })

  return apiPaginated(result.interactions.map(serializeInteraction), {
    page,
    perPage: per_page,
    total: result.total,
    pageCount: result.pageCount,
  })
})

// POST /api/v1/passes/:passId/interactions — Create interaction
export const POST = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const segments = req.nextUrl.pathname.split("/")
  const passId = segments[segments.length - 2]!

  const body = await req.json()
  const parsed = createInteractionBodySchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const { type: interactionType, metadata } = parsed.data

  // Verify pass belongs to org and is active
  const pass = await queryPassInstanceDetail(ctx.organizationId, passId)
  if (!pass) {
    throw new NotFoundError(`Pass instance with ID ${passId} was not found.`)
  }

  if (pass.status !== "ACTIVE") {
    throw new UnprocessableError(
      `Pass instance is ${pass.status}. Only ACTIVE passes accept interactions.`
    )
  }

  // ── Domain-routed types: delegate to perform* functions ──────────────────
  if (DOMAIN_INTERACTION_TYPES.has(interactionType)) {
    let result: ActionResult | { error: string }

    switch (interactionType) {
      case "STAMP":
        result = await performStamp(ctx.organizationId, passId)
        break
      case "COUPON_REDEEM":
        result = await performCouponRedeem(
          ctx.organizationId,
          passId,
          typeof metadata?.value === "string" ? metadata.value : undefined
        )
        break
      case "CHECK_IN":
        result = await performCheckIn(ctx.organizationId, passId)
        break
      case "POINTS_EARN":
        result = await performEarnPoints(
          ctx.organizationId,
          passId,
          typeof metadata?.points === "number" ? metadata.points : 1
        )
        break
      case "POINTS_REDEEM":
        result = await performRedeemPoints(
          ctx.organizationId,
          passId,
          typeof metadata?.points === "number" ? metadata.points : 0
        )
        break
      case "GIFT_CHARGE":
        result = await performGiftCardCharge(
          ctx.organizationId,
          passId,
          typeof metadata?.amountCents === "number" ? metadata.amountCents : 0
        )
        break
      case "GIFT_REFUND":
        result = await performGiftCardRefund(
          ctx.organizationId,
          passId,
          typeof metadata?.amountCents === "number" ? metadata.amountCents : 0
        )
        break
      case "TICKET_SCAN":
        result = await performTicketScan(ctx.organizationId, passId)
        break
      case "TICKET_VOID":
        result = await performTicketVoid(ctx.organizationId, passId)
        break
      default:
        throw new UnprocessableError(`Unhandled domain interaction type: ${interactionType}`)
    }

    if ("error" in result) {
      throw new UnprocessableError(result.error)
    }

    // Build a serialized interaction shape from the ActionResult.
    // The perform* functions already update contact stats internally via bumpContactStats.
    const serialized = serializeInteraction({
      id: result.interaction.id,
      type: result.interaction.type,
      metadata: (metadata ?? {}) as Prisma.JsonObject,
      createdAt: result.interaction.createdAt,
      passInstance: {
        id: passId,
        status: pass.status,
        passTemplate: {
          name: pass.passTemplate.name,
          passType: pass.passTemplate.passType,
        },
      },
      contact: {
        id: pass.contactId,
        fullName: pass.contact?.fullName ?? "",
      },
    })

    import("@/lib/api-events").then(({ dispatchWebhookEvent }) =>
      dispatchWebhookEvent(ctx.organizationId, "interaction.created", { interaction: serialized })
    ).catch(() => {})

    return apiCreated(serialized)
  }

  // ── Log-only types: raw db.interaction.create ─────────────────────────────
  if (!LOG_ONLY_INTERACTION_TYPES.has(interactionType)) {
    throw new UnprocessableError(`Unknown interaction type: ${interactionType}`)
  }

  const interaction = await db.interaction.create({
    data: {
      contactId: pass.contactId,
      organizationId: ctx.organizationId,
      passTemplateId: pass.passTemplate.id,
      passInstanceId: passId,
      type: interactionType,
      metadata: (metadata ?? {}) as Prisma.JsonObject,
    },
    select: {
      id: true,
      type: true,
      metadata: true,
      createdAt: true,
      passInstance: {
        select: {
          id: true,
          status: true,
          passTemplate: { select: { name: true, passType: true } },
        },
      },
      contact: { select: { id: true, fullName: true } },
    },
  })

  // Log-only interactions still update contact stats since they represent real activity
  await db.contact.update({
    where: { id: pass.contactId },
    data: {
      totalInteractions: { increment: 1 },
      lastInteractionAt: new Date(),
    },
  })

  const serialized = serializeInteraction(interaction as Parameters<typeof serializeInteraction>[0])

  import("@/lib/api-events").then(({ dispatchWebhookEvent }) =>
    dispatchWebhookEvent(ctx.organizationId, "interaction.created", { interaction: serialized })
  ).catch(() => {})

  return apiCreated(serialized)
})
