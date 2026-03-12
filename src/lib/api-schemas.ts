import { z } from "zod"

// ─── Shared ────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
})

const sortOrderSchema = z.enum(["asc", "desc"]).default("desc")

const PASS_TYPES = [
  "STAMP_CARD",
  "COUPON",
  "MEMBERSHIP",
  "POINTS",
  "PREPAID",
  "GIFT_CARD",
  "TICKET",
  "ACCESS",
  "TRANSIT",
  "BUSINESS_ID",
] as const

const PASS_INSTANCE_STATUSES = [
  "ACTIVE",
  "COMPLETED",
  "SUSPENDED",
  "EXPIRED",
  "REVOKED",
  "VOIDED",
] as const

const INTERACTION_TYPES = [
  "STAMP",
  "COUPON_REDEEM",
  "CHECK_IN",
  "POINTS_EARN",
  "POINTS_REDEEM",
  "PREPAID_USE",
  "PREPAID_RECHARGE",
  "GIFT_CHARGE",
  "GIFT_REFUND",
  "TICKET_SCAN",
  "TICKET_VOID",
  "ACCESS_GRANT",
  "ACCESS_DENY",
  "TRANSIT_BOARD",
  "TRANSIT_EXIT",
  "ID_VERIFY",
  "STATUS_CHANGE",
  "REWARD_EARNED",
  "REWARD_REDEEMED",
  "NOTE",
] as const

const TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const

// ─── Contacts ──────────────────────────────────────────────

export const createContactBodySchema = z.object({
  fullName: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address").max(255).optional(),
  phone: z.string().max(30).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const updateContactBodySchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  email: z.string().email("Invalid email address").max(255).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const contactListParamsSchema = paginationSchema.extend({
  search: z.string().max(100).optional(),
  sort: z
    .enum(["fullName", "createdAt", "totalInteractions", "lastInteractionAt"])
    .default("createdAt"),
  order: sortOrderSchema,
  pass_type: z.enum(PASS_TYPES).optional(),
})

// ─── Templates ─────────────────────────────────────────────

export const templateListParamsSchema = paginationSchema.extend({
  status: z.enum(TEMPLATE_STATUSES).optional(),
  pass_type: z.enum(PASS_TYPES).optional(),
})

// ─── Passes ────────────────────────────────────────────────

export const issuePassBodySchema = z.object({
  templateId: z.string().min(1, "templateId is required"),
  contactId: z.string().min(1).optional(),
  contact: z.object({
    fullName: z.string().min(1, "Name is required").max(100),
    email: z.string().email("Invalid email address").max(255).optional(),
    phone: z.string().max(30).optional(),
  }).optional(),
  sendEmail: z.boolean().default(false),
}).refine(
  (d) => d.contactId || d.contact,
  { message: "Either contactId or contact is required", path: ["contactId"] }
)

export const passListParamsSchema = paginationSchema.extend({
  contact_id: z.string().optional(),
  template_id: z.string().optional(),
  status: z.enum(PASS_INSTANCE_STATUSES).optional(),
  pass_type: z.enum(PASS_TYPES).optional(),
})

// ─── Interactions ──────────────────────────────────────────

export const interactionListParamsSchema = paginationSchema.extend({
  type: z.enum(INTERACTION_TYPES).optional(),
  contact_id: z.string().optional(),
  template_id: z.string().optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
})

export const createInteractionBodySchema = z.object({
  type: z.enum(INTERACTION_TYPES),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// ─── Actions ────────────────────────────────────────────────

export const actionBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("stamp") }),
  z.object({ action: z.literal("redeem"), value: z.string().optional() }),
  z.object({ action: z.literal("check_in") }),
  z.object({
    action: z.literal("earn_points"),
    points: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("redeem_points"),
    points: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("use"),
    amount: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("recharge"),
    uses: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("charge"),
    amountCents: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("refund"),
    amountCents: z.number().int().positive(),
  }),
  z.object({ action: z.literal("scan") }),
  z.object({ action: z.literal("void") }),
  z.object({ action: z.literal("grant") }),
  z.object({ action: z.literal("deny") }),
  z.object({ action: z.literal("board") }),
  z.object({ action: z.literal("exit") }),
  z.object({ action: z.literal("verify") }),
])

export type ActionBody = z.infer<typeof actionBodySchema>

// Action → PassType mapping
export const ACTION_TO_PASS_TYPE: Record<ActionBody["action"], string> = {
  stamp: "STAMP_CARD",
  redeem: "COUPON",
  check_in: "MEMBERSHIP",
  earn_points: "POINTS",
  redeem_points: "POINTS",
  use: "PREPAID",
  recharge: "PREPAID",
  charge: "GIFT_CARD",
  refund: "GIFT_CARD",
  scan: "TICKET",
  void: "TICKET",
  grant: "ACCESS",
  deny: "ACCESS",
  board: "TRANSIT",
  exit: "TRANSIT",
  verify: "BUSINESS_ID",
}

// ─── Bulk Operations ────────────────────────────────────────

export const bulkCreateContactsBodySchema = z.object({
  contacts: z
    .array(
      z.object({
        fullName: z.string().min(1).max(100),
        email: z.string().email().max(255).optional(),
        phone: z.string().max(30).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .min(1)
    .max(200),
  issueTemplateId: z.string().optional(),
})

export const bulkIssuePassesBodySchema = z.object({
  templateId: z.string().min(1, "templateId is required"),
  contactIds: z.array(z.string().min(1)).min(1).max(100),
})

// ─── Stats ──────────────────────────────────────────────────

export const dailyStatsParamsSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
})

// ─── Webhooks ───────────────────────────────────────────────

const WEBHOOK_EVENT_TYPES = [
  "contact.created",
  "contact.updated",
  "contact.deleted",
  "pass.issued",
  "pass.completed",
  "pass.suspended",
  "pass.revoked",
  "pass.expired",
  "pass.voided",
  "interaction.created",
  "reward.earned",
  "reward.redeemed",
  "reward.expired",
  "test.ping",
] as const

export const createWebhookBodySchema = z.object({
  url: z
    .string()
    .url("Must be a valid URL")
    .refine((u) => u.startsWith("https://"), "URL must use HTTPS"),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1, "At least one event is required"),
  enabled: z.boolean().default(true),
})

export const updateWebhookBodySchema = z.object({
  url: z
    .string()
    .url("Must be a valid URL")
    .refine((u) => u.startsWith("https://"), "URL must use HTTPS")
    .optional(),
  events: z
    .array(z.enum(WEBHOOK_EVENT_TYPES))
    .min(1, "At least one event is required")
    .optional(),
  enabled: z.boolean().optional(),
})
