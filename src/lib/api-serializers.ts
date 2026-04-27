/**
 * API serializers — Prisma rows → JSON shapes consumed by loyalshy-staff.
 * Keep in sync with `loyalshy-staff/lib/types.ts`.
 *
 * Pivot constraint: only STAMP_CARD + COUPON pass types exist.
 */

import type {
  Contact,
  PassInstance,
  PassTemplate,
  Interaction,
  Reward,
} from "@prisma/client"

// ─── Contact ────────────────────────────────────────────────

type ContactWithCount = Contact & { _count?: { passInstances: number } }

export function toApiContact(c: ContactWithCount) {
  return {
    id: c.id,
    fullName: c.fullName,
    email: c.email,
    phone: c.phone,
    memberNumber: c.memberNumber,
    totalInteractions: c.totalInteractions,
    lastInteractionAt: c.lastInteractionAt?.toISOString() ?? null,
    passInstanceCount: c._count?.passInstances ?? 0,
    metadata: (c.metadata as Record<string, unknown>) ?? {},
    createdAt: c.createdAt.toISOString(),
  }
}

// ─── PassInstance ───────────────────────────────────────────

type PassInstanceWithTemplate = PassInstance & {
  passTemplate: Pick<PassTemplate, "id" | "name" | "passType" | "config">
}

export function toApiPassInstance(p: PassInstanceWithTemplate) {
  return {
    id: p.id,
    contactId: p.contactId,
    templateId: p.passTemplateId,
    templateName: p.passTemplate.name,
    passType: p.passTemplate.passType,
    status: p.status,
    data: (p.data as Record<string, unknown>) ?? {},
    templateConfig: (p.passTemplate.config as Record<string, unknown>) ?? null,
    walletProvider: p.walletProvider,
    issuedAt: p.issuedAt.toISOString(),
    expiresAt: p.expiresAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }
}

type PassInstanceDetail = PassInstanceWithTemplate & {
  contact: Pick<Contact, "id" | "fullName" | "email">
  rewards?: Reward[]
  interactions?: (Interaction & {
    passTemplate: Pick<PassTemplate, "name" | "passType">
  })[]
}

export function toApiPassInstanceDetail(p: PassInstanceDetail) {
  return {
    ...toApiPassInstance(p),
    contact: {
      id: p.contact.id,
      fullName: p.contact.fullName,
      email: p.contact.email,
    },
    rewards: p.rewards?.map(toApiReward),
    recentInteractions:
      p.interactions?.map((i) => ({
        id: i.id,
        type: i.type,
        createdAt: i.createdAt.toISOString(),
        templateName: i.passTemplate.name,
        passType: i.passTemplate.passType,
      })) ?? [],
  }
}

// ─── Reward ─────────────────────────────────────────────────

export function toApiReward(r: Reward) {
  return {
    id: r.id,
    status: r.status,
    description: r.description,
    earnedAt: r.earnedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    revealedAt: r.revealedAt?.toISOString() ?? null,
  }
}

// ─── Interaction ────────────────────────────────────────────

type InteractionWithRefs = Interaction & {
  passInstance: (Pick<PassInstance, "id" | "status"> & {
    passTemplate: Pick<PassTemplate, "name" | "passType">
  }) | null
  contact: Pick<Contact, "id" | "fullName">
}

export function toApiInteraction(i: InteractionWithRefs) {
  return {
    id: i.id,
    type: i.type,
    metadata: (i.metadata as Record<string, unknown>) ?? {},
    createdAt: i.createdAt.toISOString(),
    pass: i.passInstance
      ? {
          id: i.passInstance.id,
          templateName: i.passInstance.passTemplate.name,
          passType: i.passInstance.passTemplate.passType,
          status: i.passInstance.status,
        }
      : null,
    contact: {
      id: i.contact.id,
      fullName: i.contact.fullName,
    },
  }
}

// ─── Template ───────────────────────────────────────────────

type TemplateWithCount = PassTemplate & { _count?: { passInstances: number } }

export function toApiTemplate(t: TemplateWithCount) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    passType: t.passType,
    status: t.status,
    config: (t.config as Record<string, unknown>) ?? {},
    startsAt: t.startsAt.toISOString(),
    endsAt: t.endsAt?.toISOString() ?? null,
    passInstanceCount: t._count?.passInstances ?? 0,
    createdAt: t.createdAt.toISOString(),
  }
}
