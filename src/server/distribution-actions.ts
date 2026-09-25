"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { getTranslations } from "next-intl/server"
import { db, getNextMemberNumber } from "@/lib/db"
import {
  assertAuthenticated,
  getOrganizationForUser,
  assertOrganizationRole,
  assertOrganizationAccess,
} from "@/lib/dal"
import { buildCardUrl } from "@/lib/card-access"
import { buildPassIssuedEmailHtml, getEmailFrom, buildWalletDownloadUrl } from "@/lib/email-templates"
import { generateApplePassForEmail } from "@/lib/wallet/generate-pass-for-email"
import { createPassInstanceForContact, sendPassIssuedEmail, PASS_TYPE_LABELS } from "@/lib/issue-pass"
import { sanitizeText } from "@/lib/sanitize"

// ─── Types ──────────────────────────────────────────────────

export type DirectIssueContact = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
}

export type IssueContactResult = {
  contactId: string
  contactName: string
  passInstanceId?: string
  status: "issued" | "already_exists" | "no_email" | "error"
  error?: string
}

export type IssuePassToContactsResult = {
  success: boolean
  results: IssueContactResult[]
  issuedCount: number
  skippedCount: number
  error?: string
}

// ─── Validation ─────────────────────────────────────────────

const issuePassSchema = z.object({
  templateId: z.string().min(1),
  contactIds: z.array(z.string().min(1)).min(1).max(100),
})

// ─── Pass Type Labels ───────────────────────────────────────

// PASS_TYPE_LABELS lives in @/lib/issue-pass (shared with the staff API)

// ─── Search Contacts for Direct Issue ───────────────────────

export async function searchContactsForIssue(
  query: string,
  templateId: string
): Promise<DirectIssueContact[]> {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) return []

  const search = query.trim()
  if (!search) return []

  const contacts = await db.contact.findMany({
    where: {
      organizationId: organization.id,
      deletedAt: null,
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ],
      // Exclude contacts who already have a pass for this template
      NOT: {
        passInstances: {
          some: { passTemplateId: templateId },
        },
      },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
    orderBy: { fullName: "asc" },
    take: 20,
  })

  return contacts
}

// ─── Issue Pass to Contacts ─────────────────────────────────

export async function issuePassToContacts(
  templateId: string,
  contactIds: string[]
): Promise<IssuePassToContactsResult> {
  const t = await getTranslations("serverErrors")
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) {
    return { success: false, results: [], issuedCount: 0, skippedCount: 0, error: t("noOrganization") }
  }

  await assertOrganizationRole(organization.id, "admin")

  const parsed = issuePassSchema.safeParse({ templateId, contactIds })
  if (!parsed.success) {
    return {
      success: false,
      results: [],
      issuedCount: 0,
      skippedCount: 0,
      error: parsed.error.issues[0]?.message ?? t("invalidInput"),
    }
  }

  // Fetch template and verify it belongs to this org and is active
  const template = await db.passTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: organization.id,
      status: "ACTIVE",
    },
    select: { id: true, name: true, passType: true, config: true },
  })

  if (!template) {
    return {
      success: false,
      results: [],
      issuedCount: 0,
      skippedCount: 0,
      error: t("programNotFound"),
    }
  }

  const results: IssueContactResult[] = []
  let issuedCount = 0
  let skippedCount = 0

  for (const contactId of parsed.data.contactIds) {
    // Verify contact belongs to this org
    const contact = await db.contact.findFirst({
      where: {
        id: contactId,
        organizationId: organization.id,
        deletedAt: null,
      },
      select: { id: true, fullName: true, email: true },
    })

    if (!contact) {
      results.push({
        contactId,
        contactName: "Unknown",
        status: "error",
        error: t("contactNotFound"),
      })
      continue
    }

    // Check if pass instance already exists
    const existing = await db.passInstance.findUnique({
      where: {
        contactId_passTemplateId: {
          contactId: contact.id,
          passTemplateId: template.id,
        },
      },
      select: { id: true },
    })

    if (existing) {
      skippedCount++
      results.push({
        contactId: contact.id,
        contactName: contact.fullName,
        status: "already_exists",
      })
      continue
    }

    const created = await createPassInstanceForContact({
      organizationId: organization.id,
      template,
      contactId: contact.id,
    })
    if (created.status === "already_exists") {
      skippedCount++
      results.push({
        contactId: contact.id,
        contactName: contact.fullName,
        status: "already_exists",
      })
      continue
    }
    const passInstance = { id: created.id }

    // Send email notification if contact has email
    if (contact.email) {
      await sendPassIssuedEmail({
        passInstanceId: passInstance.id,
        contact: { fullName: contact.fullName, email: contact.email },
        organization,
        template,
      })
    }

    issuedCount++
    results.push({
      contactId: contact.id,
      contactName: contact.fullName,
      passInstanceId: passInstance.id,
      status: contact.email ? "issued" : "no_email",
    })
  }

  revalidatePath(`/dashboard/programs/${templateId}`)
  revalidatePath("/dashboard/contacts")
  revalidatePath("/dashboard")

  return { success: true, results, issuedCount, skippedCount }
}

// ─── Create Contact & Issue Pass ────────────────────────────

export type CreateAndIssueResult = {
  success: boolean
  contactId?: string
  contactName?: string
  passInstanceId?: string
  error?: string
  duplicateField?: "email" | "phone"
}

const createAndIssueSchema = z.object({
  templateId: z.string().min(1),
  fullName: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
})

export async function createContactAndIssuePass(
  templateId: string,
  fullName: string,
  email: string,
  phone: string
): Promise<CreateAndIssueResult> {
  const t = await getTranslations("serverErrors")
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) {
    return { success: false, error: t("noOrganization") }
  }

  await assertOrganizationRole(organization.id, "admin")

  const parsed = createAndIssueSchema.safeParse({ templateId, fullName, email, phone })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? t("invalidInput") }
  }

  const cleanName = sanitizeText(parsed.data.fullName, 100)
  const cleanEmail = parsed.data.email ? sanitizeText(parsed.data.email, 255) || null : null
  const cleanPhone = parsed.data.phone ? sanitizeText(parsed.data.phone, 30) || null : null

  // Verify template
  const template = await db.passTemplate.findFirst({
    where: { id: templateId, organizationId: organization.id, status: "ACTIVE" },
    select: { id: true, name: true, passType: true, config: true },
  })

  if (!template) {
    return { success: false, error: t("programNotFound") }
  }

  // Find existing contact by email or phone, or create a new one
  let existingContact: { id: string; fullName: string; email: string | null } | null = null

  if (cleanEmail) {
    existingContact = await db.contact.findFirst({
      where: { organizationId: organization.id, email: cleanEmail, deletedAt: null },
      select: { id: true, fullName: true, email: true },
    })
  }

  if (!existingContact && cleanPhone) {
    existingContact = await db.contact.findFirst({
      where: { organizationId: organization.id, phone: cleanPhone, deletedAt: null },
      select: { id: true, fullName: true, email: true },
    })
  }

  // If existing contact found, check if they already have a pass for this program
  if (existingContact) {
    const existingPass = await db.passInstance.findUnique({
      where: {
        contactId_passTemplateId: {
          contactId: existingContact.id,
          passTemplateId: template.id,
        },
      },
      select: { id: true },
    })
    if (existingPass) {
      return { success: false, error: t("alreadyHasPass") }
    }
  }

  const contact = existingContact ?? await db.$transaction(async (tx) => {
    const memberNumber = await getNextMemberNumber(organization.id, tx)
    return tx.contact.create({
      data: {
        organizationId: organization.id,
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        memberNumber,
      },
      select: { id: true, fullName: true, email: true },
    })
  })

  // Issue pass via existing action
  const issueResult = await issuePassToContacts(templateId, [contact.id])

  if (!issueResult.success) {
    return { success: false, error: issueResult.error }
  }

  revalidatePath("/dashboard/contacts")

  const issuedPassInstanceId = issueResult.results.find(
    (r) => r.contactId === contact.id && r.passInstanceId
  )?.passInstanceId

  return { success: true, contactId: contact.id, contactName: contact.fullName, passInstanceId: issuedPassInstanceId }
}

// ─── Distribution Stats ─────────────────────────────────────

export type DistributionStats = {
  totalIssued: number
  issuedThisWeek: number
  eligibleContacts: number
}

export async function getDistributionStats(
  templateId: string
): Promise<DistributionStats> {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) return { totalIssued: 0, issuedThisWeek: 0, eligibleContacts: 0 }

  await assertOrganizationAccess(organization.id)

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const [totalIssued, issuedThisWeek, eligibleContacts] = await Promise.all([
    db.passInstance.count({
      where: { passTemplateId: templateId, passTemplate: { organizationId: organization.id } },
    }),
    db.passInstance.count({
      where: { passTemplateId: templateId, passTemplate: { organizationId: organization.id }, createdAt: { gte: weekAgo } },
    }),
    db.contact.count({
      where: {
        organizationId: organization.id,
        deletedAt: null,
        NOT: { passInstances: { some: { passTemplateId: templateId } } },
      },
    }),
  ])

  return { totalIssued, issuedThisWeek, eligibleContacts }
}

// ─── Issue Pass to All Eligible Contacts ─────────────────────

export async function issuePassToAllEligible(
  templateId: string
): Promise<IssuePassToContactsResult & { totalEligible: number }> {
  const t = await getTranslations("serverErrors")
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) {
    return { success: false, results: [], issuedCount: 0, skippedCount: 0, totalEligible: 0, error: t("noOrganization") }
  }

  await assertOrganizationRole(organization.id, "admin")

  const eligibleContacts = await db.contact.findMany({
    where: {
      organizationId: organization.id,
      deletedAt: null,
      NOT: { passInstances: { some: { passTemplateId: templateId } } },
    },
    select: { id: true },
    take: 100,
  })

  if (eligibleContacts.length === 0) {
    return { success: true, results: [], issuedCount: 0, skippedCount: 0, totalEligible: 0 }
  }

  const result = await issuePassToContacts(templateId, eligibleContacts.map((c) => c.id))
  return { ...result, totalEligible: eligibleContacts.length }
}

// ─── Send Pass Email (re-send to existing pass instance) ────

export async function sendPassEmail(
  passInstanceId: string
): Promise<{ success: boolean; error?: string }> {
  const t = await getTranslations("serverErrors")
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) {
    return { success: false, error: t("noOrganization") }
  }

  await assertOrganizationAccess(organization.id)

  const passInstance = await db.passInstance.findFirst({
    where: {
      id: passInstanceId,
      passTemplate: { organizationId: organization.id },
    },
    select: {
      id: true,
      contact: {
        select: { id: true, fullName: true, email: true },
      },
      passTemplate: {
        select: {
          name: true,
          passType: true,
          organization: {
            select: { name: true, slug: true },
          },
        },
      },
    },
  })

  if (!passInstance) {
    return { success: false, error: t("passInstanceNotFound") }
  }

  if (!passInstance.contact.email) {
    return { success: false, error: t("contactNoEmail") }
  }

  const cardUrl = buildCardUrl(
    passInstance.passTemplate.organization.slug,
    passInstance.id
  )
  const passTypeLabel = PASS_TYPE_LABELS[passInstance.passTemplate.passType] ?? "Pass"
  const orgName = passInstance.passTemplate.organization.name

  const googleWalletUrl = buildWalletDownloadUrl(passInstance.id, "google")

  try {
    const applePass = await generateApplePassForEmail(passInstance.id)

    if (process.env.TRIGGER_SECRET_KEY) {
      const { tasks } = await import("@trigger.dev/sdk")
      await tasks.trigger("send-pass-issued-email", {
        email: passInstance.contact.email,
        contactName: passInstance.contact.fullName,
        organizationName: orgName,
        templateName: passInstance.passTemplate.name,
        passTypeLabel,
        cardUrl,
        appleWalletUrl: applePass?.url,
        googleWalletUrl,
      })
    } else {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      const baseUrl = process.env.BETTER_AUTH_URL ?? "https://loyalshy.com"

      const { error: resendError } = await resend.emails.send({
        from: getEmailFrom(),
        to: passInstance.contact.email,
        subject: `Your ${passTypeLabel} from ${orgName}`,
        html: buildPassIssuedEmailHtml({
          contactName: passInstance.contact.fullName,
          organizationName: orgName,
          templateName: passInstance.passTemplate.name,
          passTypeLabel,
          cardUrl: `${baseUrl}${cardUrl}`,
          appleWalletUrl: applePass?.url,
          googleWalletUrl: `${baseUrl}${googleWalletUrl}`,
        }),
      })

      if (resendError) {
        return { success: false, error: resendError.message }
      }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to send pass email:", message)
    return { success: false, error: message }
  }
}

