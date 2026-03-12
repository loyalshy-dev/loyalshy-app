import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { actionBodySchema, ACTION_TO_PASS_TYPE } from "@/lib/api-schemas"
import {
  queryPassInstanceDetail,
  performStamp,
  performCouponRedeem,
  performCheckIn,
  performEarnPoints,
  performRedeemPoints,
  performPrepaidUse,
  performPrepaidRecharge,
  performGiftCardCharge,
  performGiftCardRefund,
  performTicketScan,
  performTicketVoid,
  performAccessGrant,
  performAccessDeny,
  performTransitBoard,
  performTransitExit,
  performIdVerify,
} from "@/lib/api-data"
import { apiCreated } from "@/lib/api-response"
import {
  ValidationError,
  NotFoundError,
  UnprocessableError,
} from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// POST /api/v1/passes/:passId/actions — Perform a type-specific action
export const POST = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const segments = req.nextUrl.pathname.split("/")
  // /api/v1/passes/[id]/actions → id is at index -2
  const passId = segments[segments.length - 2]!

  const body = await req.json()
  const parsed = actionBodySchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const action = parsed.data

  // Verify pass exists and belongs to org
  const pass = await queryPassInstanceDetail(ctx.organizationId, passId)
  if (!pass) {
    throw new NotFoundError(`Pass instance with ID ${passId} was not found.`)
  }

  // Validate action matches pass type
  const expectedType = ACTION_TO_PASS_TYPE[action.action]
  if (pass.passTemplate.passType !== expectedType) {
    throw new UnprocessableError(
      `Action "${action.action}" is not valid for pass type ${pass.passTemplate.passType}. Expected pass type: ${expectedType}.`
    )
  }

  // Dispatch to the appropriate action handler
  let result: Awaited<ReturnType<typeof performStamp>>

  switch (action.action) {
    case "stamp":
      result = await performStamp(ctx.organizationId, passId)
      break
    case "redeem":
      result = await performCouponRedeem(
        ctx.organizationId,
        passId,
        action.value
      )
      break
    case "check_in":
      result = await performCheckIn(ctx.organizationId, passId)
      break
    case "earn_points":
      result = await performEarnPoints(
        ctx.organizationId,
        passId,
        action.points
      )
      break
    case "redeem_points":
      result = await performRedeemPoints(
        ctx.organizationId,
        passId,
        action.points
      )
      break
    case "use":
      result = await performPrepaidUse(
        ctx.organizationId,
        passId,
        action.amount
      )
      break
    case "recharge":
      result = await performPrepaidRecharge(
        ctx.organizationId,
        passId,
        action.uses
      )
      break
    case "charge":
      result = await performGiftCardCharge(
        ctx.organizationId,
        passId,
        action.amountCents
      )
      break
    case "refund":
      result = await performGiftCardRefund(
        ctx.organizationId,
        passId,
        action.amountCents
      )
      break
    case "scan":
      result = await performTicketScan(ctx.organizationId, passId)
      break
    case "void":
      result = await performTicketVoid(ctx.organizationId, passId)
      break
    case "grant":
      result = await performAccessGrant(ctx.organizationId, passId)
      break
    case "deny":
      result = await performAccessDeny(ctx.organizationId, passId)
      break
    case "board":
      result = await performTransitBoard(ctx.organizationId, passId)
      break
    case "exit":
      result = await performTransitExit(ctx.organizationId, passId)
      break
    case "verify":
      result = await performIdVerify(ctx.organizationId, passId)
      break
  }

  if ("error" in result) {
    throw new UnprocessableError(result.error)
  }

  const responseData = {
    action: result.action,
    passInstanceId: result.passInstanceId,
    result: result.result,
    interaction: {
      id: result.interaction.id,
      type: result.interaction.type,
      createdAt: result.interaction.createdAt.toISOString(),
    },
  }

  import("@/lib/api-events").then(({ dispatchWebhookEvent }) =>
    dispatchWebhookEvent(ctx.organizationId, "interaction.created", responseData)
  ).catch(() => {})

  return apiCreated(responseData)
})
