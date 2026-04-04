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
  performGiftCardCharge,
  performGiftCardRefund,
  performTicketScan,
  performTicketVoid,
} from "@/lib/api-data"
import { serializePassInstanceDetail } from "@/lib/api-serializers"
import { apiSuccess, apiCreated } from "@/lib/api-response"
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

  // Use the real pass instance ID (passId from URL could be a walletPassId)
  const realPassId = pass.id

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
      result = await performStamp(ctx.organizationId, realPassId)
      break
    case "redeem":
      result = await performCouponRedeem(
        ctx.organizationId,
        realPassId,
        action.value
      )
      break
    case "check_in":
      result = await performCheckIn(ctx.organizationId, realPassId)
      break
    case "earn_points":
      result = await performEarnPoints(
        ctx.organizationId,
        realPassId,
        action.points
      )
      break
    case "redeem_points":
      result = await performRedeemPoints(
        ctx.organizationId,
        realPassId,
        action.points
      )
      break
    case "charge":
      result = await performGiftCardCharge(
        ctx.organizationId,
        realPassId,
        action.amountCents
      )
      break
    case "refund":
      result = await performGiftCardRefund(
        ctx.organizationId,
        realPassId,
        action.amountCents
      )
      break
    case "scan":
      result = await performTicketScan(ctx.organizationId, realPassId)
      break
    case "void":
      result = await performTicketVoid(ctx.organizationId, realPassId)
      break
  }

  if ("error" in result) {
    throw new UnprocessableError(result.error)
  }

  // Webhook event payload (action result shape)
  const webhookData = {
    action: result.action,
    passInstanceId: result.passInstanceId,
    result: result.result,
    interaction: {
      id: result.interaction.id,
      type: result.interaction.type,
      createdAt: result.interaction.createdAt.toISOString(),
    },
  }

  // Dispatch webhook event (fire-and-forget)
  import("@/lib/api-events").then(({ dispatchWebhookEvent }) =>
    dispatchWebhookEvent(ctx.organizationId, "interaction.created", webhookData)
  ).catch(() => {})

  // Trigger wallet pass update (fire-and-forget)
  const walletUpdateTypes: Record<string, string> = {
    stamp: "STAMP",
    redeem: "VISIT",
    check_in: "CHECK_IN",
    earn_points: "POINTS_EARNED",
    redeem_points: "POINTS_REDEEMED",
    charge: "GIFT_CHARGE",
    refund: "GIFT_REFUND",
    scan: "TICKET_SCAN",
    void: "TICKET_VOID",
  }

  if (process.env.TRIGGER_SECRET_KEY) {
    import("@trigger.dev/sdk")
      .then(({ tasks }) =>
        tasks.trigger("update-wallet-pass", {
          passInstanceId: realPassId,
          updateType: walletUpdateTypes[action.action] ?? "VISIT",
        })
      )
      .catch(() => {})
  }

  // Re-fetch and return the updated pass detail (staff app needs full pass state)
  const updatedPass = await queryPassInstanceDetail(ctx.organizationId, realPassId)
  if (!updatedPass) {
    throw new NotFoundError("Pass instance not found after action.")
  }

  return apiSuccess(serializePassInstanceDetail(updatedPass))
})
