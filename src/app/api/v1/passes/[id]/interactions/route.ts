import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { interactionListParamsSchema, createInteractionBodySchema } from "@/lib/api-schemas"
import {
  queryPassInteractions,
  queryPassInstanceDetail,
} from "@/lib/api-data"
import { serializeInteraction } from "@/lib/api-serializers"
import { apiPaginated, apiCreated } from "@/lib/api-response"
import { ValidationError, NotFoundError, UnprocessableError } from "@/lib/api-errors"
import { db } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import type { ApiContext } from "@/lib/api-auth"

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

  // Create the interaction record
  const interaction = await db.interaction.create({
    data: {
      contactId: pass.contactId,
      organizationId: ctx.organizationId,
      passTemplateId: pass.passTemplate.id,
      passInstanceId: passId,
      type: parsed.data.type,
      metadata: (parsed.data.metadata ?? {}) as Prisma.JsonObject,
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

  // Update contact stats
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
