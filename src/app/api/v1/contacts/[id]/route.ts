import { type NextRequest } from "next/server"
import { apiHandler } from "@/lib/api-handler"
import { handlePreflight } from "@/lib/api-cors"
import { updateContactBodySchema } from "@/lib/api-schemas"
import {
  queryContactDetail,
  updateContact,
  softDeleteContact,
} from "@/lib/api-data"
import { serializeContactDetail } from "@/lib/api-serializers"
import { apiSuccess, apiNoContent } from "@/lib/api-response"
import { NotFoundError, ValidationError, ConflictError } from "@/lib/api-errors"
import type { ApiContext } from "@/lib/api-auth"

export const OPTIONS = handlePreflight

// GET /api/v1/contacts/:id — Get contact detail
export const GET = apiHandler(
  async (req: NextRequest, ctx: ApiContext) => {
    const id = req.nextUrl.pathname.split("/").pop()!
    const contact = await queryContactDetail(ctx.organizationId, id)

    if (!contact) {
      throw new NotFoundError(`Contact with ID ${id} was not found.`)
    }

    return apiSuccess(serializeContactDetail(contact))
  }
)

// PATCH /api/v1/contacts/:id — Update contact
export const PATCH = apiHandler(
  async (req: NextRequest, ctx: ApiContext) => {
    const id = req.nextUrl.pathname.split("/").pop()!
    const body = await req.json()
    const parsed = updateContactBodySchema.safeParse(body)

    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        }))
      )
    }

    const result = await updateContact(ctx.organizationId, id, parsed.data)

    if (!result.success) {
      if (result.duplicateField) {
        throw new ConflictError(result.error)
      }
      throw new NotFoundError(result.error)
    }

    // Return updated contact
    const contact = await queryContactDetail(ctx.organizationId, id)
    if (!contact) throw new NotFoundError("Contact not found after update.")

    const serialized = serializeContactDetail(contact)

    import("@/lib/api-events").then(({ dispatchWebhookEvent }) =>
      dispatchWebhookEvent(ctx.organizationId, "contact.updated", { contact: serialized })
    ).catch(() => {})

    return apiSuccess(serialized)
  }
)

// DELETE /api/v1/contacts/:id — Soft delete contact
export const DELETE = apiHandler(
  async (req: NextRequest, ctx: ApiContext) => {
    const id = req.nextUrl.pathname.split("/").pop()!
    const result = await softDeleteContact(ctx.organizationId, id)

    if (!result.success) {
      throw new NotFoundError(`Contact with ID ${id} was not found.`)
    }

    import("@/lib/api-events").then(({ dispatchWebhookEvent }) =>
      dispatchWebhookEvent(ctx.organizationId, "contact.deleted", { contactId: id })
    ).catch(() => {})

    return apiNoContent()
  }
)
