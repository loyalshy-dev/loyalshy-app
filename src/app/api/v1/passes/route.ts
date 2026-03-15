import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { passListParamsSchema, issuePassBodySchema } from "@/lib/api-schemas"
import {
  queryPassInstances,
  issuePass,
  queryPassInstanceDetail,
  findOrCreateContact,
  buildWalletUrls,
  sendPassIssuedEmail,
} from "@/lib/api-data"
import { serializePassInstance, serializePassInstanceDetail } from "@/lib/api-serializers"
import { apiPaginated, apiCreated } from "@/lib/api-response"
import { ValidationError, ConflictError, UnprocessableError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// GET /api/v1/passes — List pass instances
export const GET = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = passListParamsSchema.safeParse(params)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const { page, per_page, contact_id, template_id, status, pass_type } = parsed.data
  const result = await queryPassInstances(ctx.organizationId, {
    page,
    perPage: per_page,
    contactId: contact_id,
    templateId: template_id,
    status,
    passType: pass_type,
  })

  return apiPaginated(result.instances.map(serializePassInstance), {
    page,
    perPage: per_page,
    total: result.total,
    pageCount: result.pageCount,
  })
})

// POST /api/v1/passes — Issue a pass
export const POST = apiHandler(async (req: NextRequest, ctx: ApiContext) => {
  const body = await req.json()
  const parsed = issuePassBodySchema.safeParse(body)

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }))
    )
  }

  const { templateId, sendEmail } = parsed.data
  let contactId = parsed.data.contactId
  let contactCreated = false

  // Check contact limit before potential contact creation
  if (!contactId && parsed.data.contact) {
    const { checkContactLimit } = await import("@/server/billing-actions")
    const limitCheck = await checkContactLimit(ctx.organizationId)
    if (!limitCheck.allowed) {
      throw new UnprocessableError(
        `Contact limit reached (${limitCheck.limit}). Upgrade your plan to add more contacts.`
      )
    }
  }

  // Resolve contact: inline creation or existing contactId
  if (!contactId && parsed.data.contact) {
    const contactResult = await findOrCreateContact(
      ctx.organizationId,
      parsed.data.contact
    )
    contactId = contactResult.contactId
    contactCreated = contactResult.created
  }

  const result = await issuePass(ctx.organizationId, templateId, contactId!)

  if (!result.success) {
    if (result.error.includes("already issued")) {
      throw new ConflictError(result.error)
    }
    throw new UnprocessableError(result.error)
  }

  // Fetch the created pass instance for response
  const detail = await queryPassInstanceDetail(ctx.organizationId, result.passInstanceId)
  if (!detail) throw new Error("Created pass instance not found")

  const serialized = serializePassInstanceDetail(detail)

  // Always build wallet URLs
  const walletUrls = await buildWalletUrls(result.passInstanceId, ctx.organizationId)
  serialized.walletUrls = walletUrls

  // Send email if requested (fire-and-forget — don't fail the request)
  let emailSent = false
  if (sendEmail && detail.contact.email) {
    const emailResult = await sendPassIssuedEmail(
      result.passInstanceId,
      ctx.organizationId
    )
    emailSent = emailResult.emailSent

    // Refresh Apple wallet URL if pass was just generated
    if (emailSent) {
      const refreshedUrls = await buildWalletUrls(result.passInstanceId, ctx.organizationId)
      serialized.walletUrls = refreshedUrls
    }
  }
  serialized.emailSent = emailSent

  // Dispatch webhooks asynchronously
  import("@/lib/api-events").then(({ dispatchWebhookEvent }) => {
    if (contactCreated) {
      dispatchWebhookEvent(ctx.organizationId, "contact.created", {
        contact: serialized.contact,
      }).catch(() => {})
    }
    dispatchWebhookEvent(ctx.organizationId, "pass.issued", {
      pass: serialized,
    }).catch(() => {})
  }).catch(() => {})

  return apiCreated(serialized)
})
