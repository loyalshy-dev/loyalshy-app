"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationAccess } from "@/lib/dal"
import { parseMinigameConfig, weightedRandomPrize } from "@/lib/pass-config"
import type { PassInstanceSummary } from "@/types/pass-instance"

// ─── Types ──────────────────────────────────────────────────

export type StampSearchResult = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  totalInteractions: number
  lastInteractionAt: Date | null
  passInstances: PassInstanceSummary[]
}

export type RegisterStampResult = {
  success: boolean
  error?: string
  wasRewardEarned: boolean
  rewardDescription?: string
  newCycleVisits: number
  newTotalInteractions: number
  visitsRequired: number
  templateName?: string
}

// ─── QR Scan Lookup ──────────────────────────────────────────

export type ScanLookupResult = {
  success: boolean
  error?: string
  errorType?: "NOT_FOUND" | "REVOKED" | "COMPLETED" | "MARKETING_QR" | "INVALID_FORMAT"
  contact?: StampSearchResult
  passInstance?: PassInstanceSummary
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function lookupPassInstanceByWalletPassId(
  walletPassId: string
): Promise<ScanLookupResult> {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) {
    return { success: false, error: "No organization found", errorType: "NOT_FOUND" }
  }

  // Reject URLs (marketing QR codes)
  if (walletPassId.startsWith("http://") || walletPassId.startsWith("https://")) {
    return {
      success: false,
      error: "This is a join link, not a wallet pass. Scan the QR code on the customer's wallet.",
      errorType: "MARKETING_QR",
    }
  }

  // Validate UUID format
  if (!UUID_RE.test(walletPassId.trim())) {
    return {
      success: false,
      error: "Unrecognized QR code. Please scan a wallet pass.",
      errorType: "INVALID_FORMAT",
    }
  }

  const passInstance = await db.passInstance.findUnique({
    where: { walletPassId: walletPassId.trim() },
    include: {
      contact: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          totalInteractions: true,
          lastInteractionAt: true,
          organizationId: true,
          deletedAt: true,
        },
      },
      passTemplate: {
        select: {
          id: true,
          name: true,
          passType: true,
          status: true,
          config: true,
          passDesign: {
            select: {
              cardType: true,
              primaryColor: true,
              secondaryColor: true,
              textColor: true,
              showStrip: true,
              patternStyle: true,
              progressStyle: true,
              labelFormat: true,
              customProgressLabel: true,
              stripImageUrl: true,
              editorConfig: true,
              logoUrl: true,
              logoAppleUrl: true,
              logoGoogleUrl: true,
            },
          },
        },
      },
    },
  })

  if (!passInstance) {
    return {
      success: false,
      error: "Card not recognized. The customer may need to re-add their wallet pass.",
      errorType: "NOT_FOUND",
    }
  }

  // Cross-tenant check
  if (passInstance.contact.organizationId !== organization.id) {
    return {
      success: false,
      error: "Card not recognized. The customer may need to re-add their wallet pass.",
      errorType: "NOT_FOUND",
    }
  }

  // Soft-deleted contact
  if (passInstance.contact.deletedAt) {
    return {
      success: false,
      error: "Card not recognized. The customer may need to re-add their wallet pass.",
      errorType: "NOT_FOUND",
    }
  }

  // Revoked pass instance
  if (passInstance.status === "REVOKED") {
    return {
      success: false,
      error: "This pass has been revoked.",
      errorType: "REVOKED",
    }
  }

  // Completed pass instance
  if (passInstance.status === "COMPLETED") {
    return {
      success: false,
      error: "This pass is complete.",
      errorType: "COMPLETED",
    }
  }

  // Expired pass instance
  if (passInstance.status === "EXPIRED") {
    return {
      success: false,
      error: "This pass has expired.",
      errorType: "COMPLETED",
    }
  }

  // Fetch all active pass instances for this contact
  const allInstances = await db.passInstance.findMany({
    where: {
      contactId: passInstance.contact.id,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      passTemplate: { status: "ACTIVE" },
    },
    select: {
      id: true,
      data: true,
      walletProvider: true,
      status: true,
      passTemplate: {
        select: {
          id: true,
          name: true,
          passType: true,
          config: true,
          passDesign: {
            select: {
              cardType: true,
              primaryColor: true,
              secondaryColor: true,
              textColor: true,
              showStrip: true,
              patternStyle: true,
              progressStyle: true,
              labelFormat: true,
              customProgressLabel: true,
              stripImageUrl: true,
              editorConfig: true,
              logoUrl: true,
              logoAppleUrl: true,
              logoGoogleUrl: true,
            },
          },
        },
      },
    },
  })

  const contact: StampSearchResult = {
    id: passInstance.contact.id,
    fullName: passInstance.contact.fullName,
    email: passInstance.contact.email,
    phone: passInstance.contact.phone,
    totalInteractions: passInstance.contact.totalInteractions,
    lastInteractionAt: passInstance.contact.lastInteractionAt,
    passInstances: allInstances.map((pi) => ({
      passInstanceId: pi.id,
      templateId: pi.passTemplate.id,
      templateName: pi.passTemplate.name,
      passType: pi.passTemplate.passType,
      data: pi.data as import("@/types/pass-instance").PassInstanceData,
      templateConfig: pi.passTemplate.config,
      status: pi.status,
      walletProvider: pi.walletProvider,
      passDesign: pi.passTemplate.passDesign
        ? {
            cardType: pi.passTemplate.passDesign.cardType,
            primaryColor: pi.passTemplate.passDesign.primaryColor,
            secondaryColor: pi.passTemplate.passDesign.secondaryColor,
            textColor: pi.passTemplate.passDesign.textColor,
            showStrip: pi.passTemplate.passDesign.showStrip,
            patternStyle: pi.passTemplate.passDesign.patternStyle,
            progressStyle: pi.passTemplate.passDesign.progressStyle,
            labelFormat: pi.passTemplate.passDesign.labelFormat,
            customProgressLabel: pi.passTemplate.passDesign.customProgressLabel,
            stripImageUrl: pi.passTemplate.passDesign.stripImageUrl,
            editorConfig: pi.passTemplate.passDesign.editorConfig,
            logoUrl: pi.passTemplate.passDesign.logoUrl,
            logoAppleUrl: pi.passTemplate.passDesign.logoAppleUrl,
            logoGoogleUrl: pi.passTemplate.passDesign.logoGoogleUrl,
          }
        : null,
      minigameConfig: parseMinigameConfig(pi.passTemplate.config),
    })),
  }

  const instanceSummary: PassInstanceSummary = {
    passInstanceId: passInstance.id,
    templateId: passInstance.passTemplate.id,
    templateName: passInstance.passTemplate.name,
    passType: passInstance.passTemplate.passType,
    data: passInstance.data as import("@/types/pass-instance").PassInstanceData,
    templateConfig: passInstance.passTemplate.config,
    status: passInstance.status,
    walletProvider: passInstance.walletProvider,
    passDesign: passInstance.passTemplate.passDesign
      ? {
          cardType: passInstance.passTemplate.passDesign.cardType,
          primaryColor: passInstance.passTemplate.passDesign.primaryColor,
          secondaryColor: passInstance.passTemplate.passDesign.secondaryColor,
          textColor: passInstance.passTemplate.passDesign.textColor,
          showStrip: passInstance.passTemplate.passDesign.showStrip,
          patternStyle: passInstance.passTemplate.passDesign.patternStyle,
          progressStyle: passInstance.passTemplate.passDesign.progressStyle,
          labelFormat: passInstance.passTemplate.passDesign.labelFormat,
          customProgressLabel: passInstance.passTemplate.passDesign.customProgressLabel,
          stripImageUrl: passInstance.passTemplate.passDesign.stripImageUrl,
          editorConfig: passInstance.passTemplate.passDesign.editorConfig,
          logoUrl: passInstance.passTemplate.passDesign.logoUrl,
          logoAppleUrl: passInstance.passTemplate.passDesign.logoAppleUrl,
          logoGoogleUrl: passInstance.passTemplate.passDesign.logoGoogleUrl,
        }
      : null,
    minigameConfig: parseMinigameConfig(passInstance.passTemplate.config),
  }

  return {
    success: true,
    contact,
    passInstance: instanceSummary,
  }
}

// ─── Search Contacts for Stamp Registration ────────────────

export type StampSearchResponse = {
  contacts: StampSearchResult[]
}

export async function searchContactsForStamp(
  query: string
): Promise<StampSearchResponse> {
  await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) return { contacts: [] }

  const search = query.trim()
  if (!search) return { contacts: [] }

  const contacts = await db.contact.findMany({
    where: {
      organizationId: organization.id,
      deletedAt: null,
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      totalInteractions: true,
      lastInteractionAt: true,
      passInstances: {
        where: {
          status: { in: ["ACTIVE", "SUSPENDED"] },
          passTemplate: { status: "ACTIVE" },
        },
        select: {
          id: true,
          data: true,
          walletProvider: true,
          status: true,
          passTemplate: {
            select: {
              id: true,
              name: true,
              passType: true,
              config: true,
              passDesign: {
                select: {
                  cardType: true,
                  primaryColor: true,
                  secondaryColor: true,
                  textColor: true,
                  showStrip: true,
                  patternStyle: true,
                  progressStyle: true,
                  labelFormat: true,
                  customProgressLabel: true,
                  stripImageUrl: true,
                  editorConfig: true,
                  logoUrl: true,
                  logoAppleUrl: true,
                  logoGoogleUrl: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { fullName: "asc" },
    take: 10,
  })

  return {
    contacts: contacts.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      totalInteractions: c.totalInteractions,
      lastInteractionAt: c.lastInteractionAt,
      passInstances: c.passInstances.map((pi) => ({
        passInstanceId: pi.id,
        templateId: pi.passTemplate.id,
        templateName: pi.passTemplate.name,
        passType: pi.passTemplate.passType,
        data: pi.data as import("@/types/pass-instance").PassInstanceData,
        templateConfig: pi.passTemplate.config,
        status: pi.status,
        walletProvider: pi.walletProvider,
        passDesign: pi.passTemplate.passDesign
          ? {
              cardType: pi.passTemplate.passDesign.cardType,
              primaryColor: pi.passTemplate.passDesign.primaryColor,
              secondaryColor: pi.passTemplate.passDesign.secondaryColor,
              textColor: pi.passTemplate.passDesign.textColor,
              showStrip: pi.passTemplate.passDesign.showStrip,
              patternStyle: pi.passTemplate.passDesign.patternStyle,
              progressStyle: pi.passTemplate.passDesign.progressStyle,
              labelFormat: pi.passTemplate.passDesign.labelFormat,
              customProgressLabel: pi.passTemplate.passDesign.customProgressLabel,
              stripImageUrl: pi.passTemplate.passDesign.stripImageUrl,
              editorConfig: pi.passTemplate.passDesign.editorConfig,
              logoUrl: pi.passTemplate.passDesign.logoUrl,
              logoAppleUrl: pi.passTemplate.passDesign.logoAppleUrl,
              logoGoogleUrl: pi.passTemplate.passDesign.logoGoogleUrl,
            }
          : null,
        minigameConfig: parseMinigameConfig(pi.passTemplate.config),
      })),
    })),
  }
}

// ─── Register Stamp ─────────────────────────────────────────

export async function registerStamp(
  passInstanceId: string
): Promise<RegisterStampResult> {
  const session = await assertAuthenticated()
  const organization = await getOrganizationForUser()

  if (!organization) {
    return {
      success: false,
      error: "No organization found",
      wasRewardEarned: false,
      newCycleVisits: 0,
      newTotalInteractions: 0,
      visitsRequired: 0,
    }
  }

  await assertOrganizationAccess(organization.id)

  // Fetch pass instance with template and contact
  const passInstance = await db.passInstance.findUnique({
    where: { id: passInstanceId },
    include: {
      contact: {
        select: {
          id: true,
          organizationId: true,
          deletedAt: true,
          totalInteractions: true,
          fullName: true,
        },
      },
      passTemplate: {
        select: {
          id: true,
          name: true,
          passType: true,
          config: true,
          status: true,
          endsAt: true,
        },
      },
    },
  })

  if (!passInstance) {
    return {
      success: false,
      error: "Pass instance not found",
      wasRewardEarned: false,
      newCycleVisits: 0,
      newTotalInteractions: 0,
      visitsRequired: 0,
    }
  }

  // Validate pass instance belongs to this organization
  if (passInstance.contact.organizationId !== organization.id) {
    return {
      success: false,
      error: "Pass instance not found",
      wasRewardEarned: false,
      newCycleVisits: 0,
      newTotalInteractions: 0,
      visitsRequired: 0,
    }
  }

  if (passInstance.contact.deletedAt) {
    return {
      success: false,
      error: "Contact has been deleted",
      wasRewardEarned: false,
      newCycleVisits: 0,
      newTotalInteractions: 0,
      visitsRequired: 0,
    }
  }

  if (passInstance.status !== "ACTIVE") {
    return {
      success: false,
      error: `This pass is ${passInstance.status.toLowerCase()}`,
      wasRewardEarned: false,
      newCycleVisits: 0,
      newTotalInteractions: 0,
      visitsRequired: 0,
    }
  }

  if (passInstance.passTemplate.status !== "ACTIVE") {
    return {
      success: false,
      error: "This pass template is no longer active",
      wasRewardEarned: false,
      newCycleVisits: 0,
      newTotalInteractions: 0,
      visitsRequired: 0,
    }
  }

  // Only stamp card templates support stamp registration
  if (passInstance.passTemplate.passType !== "STAMP_CARD") {
    return {
      success: false,
      error: "Stamp registration is only available for stamp card passes",
      wasRewardEarned: false,
      newCycleVisits: 0,
      newTotalInteractions: 0,
      visitsRequired: 0,
    }
  }

  // Check template hasn't expired
  if (passInstance.passTemplate.endsAt && passInstance.passTemplate.endsAt < new Date()) {
    return {
      success: false,
      error: "This pass template has expired",
      wasRewardEarned: false,
      newCycleVisits: 0,
      newTotalInteractions: 0,
      visitsRequired: 0,
    }
  }

  const template = passInstance.passTemplate
  const templateConfig = template.config as Record<string, unknown>
  const visitsRequired = (templateConfig?.stampsRequired as number) ?? 10
  const rewardDescription = (templateConfig?.rewardDescription as string) ?? "Free reward"
  const rewardExpiryDays = (templateConfig?.rewardExpiryDays as number) ?? 90

  // Extract current state from passInstance.data JSON
  const instanceData = (passInstance.data as Record<string, unknown>) ?? {}
  const currentCycleVisits = (instanceData.currentCycleVisits as number) ?? 0
  const totalVisits = (instanceData.totalVisits as number) ?? 0

  // Prevent double-registration within 1 minute
  const oneMinuteAgo = new Date(Date.now() - 60_000)
  const recentInteraction = await db.interaction.findFirst({
    where: {
      passInstanceId: passInstance.id,
      createdAt: { gte: oneMinuteAgo },
    },
    select: { id: true },
  })

  if (recentInteraction) {
    return {
      success: false,
      error: "A stamp was already registered for this pass less than a minute ago",
      wasRewardEarned: false,
      newCycleVisits: currentCycleVisits,
      newTotalInteractions: totalVisits,
      visitsRequired,
    }
  }

  // Calculate new counts
  const newCycleVisits = currentCycleVisits + 1
  const newTotalVisits = totalVisits + 1
  const newContactTotalInteractions = passInstance.contact.totalInteractions + 1
  const wasRewardEarned = newCycleVisits >= visitsRequired

  // Pick a weighted random prize if minigame has prizes configured
  let selectedPrize: string | undefined
  if (wasRewardEarned) {
    const mgConfig = parseMinigameConfig(template.config)
    if (mgConfig?.enabled && mgConfig.prizes?.length) {
      selectedPrize = weightedRandomPrize(mgConfig.prizes)
    }
  }

  // Run everything in a transaction
  await db.$transaction(async (tx) => {
    // Create Interaction record
    await tx.interaction.create({
      data: {
        contactId: passInstance.contact.id,
        organizationId: organization.id,
        passTemplateId: template.id,
        passInstanceId: passInstance.id,
        performedById: session.user.id,
        type: "STAMP",
        metadata: { visitNumber: newCycleVisits },
      },
    })

    if (wasRewardEarned) {
      // Reset cycle on pass instance and create reward
      await tx.passInstance.update({
        where: { id: passInstance.id },
        data: {
          data: {
            ...instanceData,
            currentCycleVisits: 0,
            totalVisits: newTotalVisits,
          },
        },
      })

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + rewardExpiryDays)

      await tx.reward.create({
        data: {
          contactId: passInstance.contact.id,
          organizationId: organization.id,
          passTemplateId: template.id,
          passInstanceId: passInstance.id,
          status: "AVAILABLE",
          expiresAt,
          description: selectedPrize ?? null,
          revealedAt: (selectedPrize && parseMinigameConfig(template.config)?.enabled) ? null : new Date(),
        },
      })
    } else {
      // Just increment visit counts
      await tx.passInstance.update({
        where: { id: passInstance.id },
        data: {
          data: {
            ...instanceData,
            currentCycleVisits: newCycleVisits,
            totalVisits: newTotalVisits,
          },
        },
      })
    }

    // Always update Contact denormalized counters
    await tx.contact.update({
      where: { id: passInstance.contact.id },
      data: {
        totalInteractions: newContactTotalInteractions,
        lastInteractionAt: new Date(),
      },
    })
  })

  // Dispatch wallet pass update via Trigger.dev
  if (passInstance.walletProvider !== "NONE") {
    if (process.env.TRIGGER_SECRET_KEY) {
      import("@trigger.dev/sdk")
        .then(({ tasks }) =>
          tasks.trigger("update-wallet-pass", {
            passInstanceId: passInstance.id,
            updateType: wasRewardEarned ? "REWARD_EARNED" : "STAMP",
          })
        )
        .catch((err: unknown) => console.error("Wallet pass update dispatch failed:", err instanceof Error ? err.message : "Unknown error"))
    } else if (passInstance.walletProvider === "GOOGLE") {
      import("@/lib/wallet/google/update-pass")
        .then(({ notifyGooglePassUpdate }) => notifyGooglePassUpdate(passInstance.id))
        .catch((err: unknown) => console.error("Direct Google pass update failed:", err instanceof Error ? err.message : "Unknown error"))
    } else if (passInstance.walletProvider === "APPLE") {
      import("@/lib/wallet/apple/update-pass")
        .then(({ notifyApplePassUpdate }) => notifyApplePassUpdate(passInstance.id))
        .catch((err: unknown) => console.error("Direct Apple pass update failed:", err instanceof Error ? err.message : "Unknown error"))
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/contacts")

  return {
    success: true,
    wasRewardEarned,
    rewardDescription: wasRewardEarned ? (selectedPrize ?? rewardDescription) : undefined,
    newCycleVisits: wasRewardEarned ? 0 : newCycleVisits,
    newTotalInteractions: newTotalVisits,
    visitsRequired,
    templateName: template.name,
  }
}
