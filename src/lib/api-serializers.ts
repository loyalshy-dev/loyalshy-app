// ─── API Resource Serializers ──────────────────────────────
// Consistent serialization: ISO dates, camelCase, no internal fields.

type DateLike = Date | string | null | undefined

function toISO(d: DateLike): string | null {
  if (!d) return null
  return d instanceof Date ? d.toISOString() : d
}

// ─── Contact ───────────────────────────────────────────────

export type ApiContact = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  memberNumber: number
  totalInteractions: number
  lastInteractionAt: string | null
  passInstanceCount: number
  metadata: Record<string, unknown>
  createdAt: string
}

export function serializeContact(contact: {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  memberNumber: number
  totalInteractions: number
  lastInteractionAt: DateLike
  metadata?: unknown
  createdAt: DateLike
  _count?: { passInstances: number }
  passInstances?: unknown[]
}): ApiContact {
  return {
    id: contact.id,
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    memberNumber: contact.memberNumber,
    totalInteractions: contact.totalInteractions,
    lastInteractionAt: toISO(contact.lastInteractionAt),
    passInstanceCount:
      contact._count?.passInstances ?? contact.passInstances?.length ?? 0,
    metadata: (contact.metadata as Record<string, unknown>) ?? {},
    createdAt: toISO(contact.createdAt)!,
  }
}

// ─── Contact Detail ────────────────────────────────────────

export type ApiContactDetail = ApiContact & {
  passInstances: ApiPassInstanceSummary[]
  recentInteractions: ApiInteractionSummary[]
  rewards: ApiRewardSummary[]
}

type ApiPassInstanceSummary = {
  id: string
  templateId: string
  templateName: string
  passType: string
  status: string
  data: unknown
  walletProvider: string
  issuedAt: string
  expiresAt: string | null
}

type ApiInteractionSummary = {
  id: string
  type: string
  createdAt: string
  templateName: string
  passType: string
}

type ApiRewardSummary = {
  id: string
  status: string
  description: string | null
  earnedAt: string
  redeemedAt: string | null
  expiresAt: string
}

export function serializeContactDetail(contact: {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  memberNumber: number
  totalInteractions: number
  lastInteractionAt: DateLike
  metadata?: unknown
  createdAt: DateLike
  passInstances: Array<{
    id: string
    status: string
    data: unknown
    walletProvider: string
    issuedAt: DateLike
    expiresAt: DateLike
    passTemplate: {
      id: string
      name: string
      passType: string
    }
  }>
  interactions: Array<{
    id: string
    type: string
    createdAt: DateLike
    passTemplate: { name: string; passType: string }
  }>
  rewards: Array<{
    id: string
    status: string
    description: string | null
    earnedAt: DateLike
    redeemedAt: DateLike
    expiresAt: DateLike
  }>
}): ApiContactDetail {
  return {
    ...serializeContact({
      ...contact,
      passInstances: contact.passInstances,
    }),
    passInstances: contact.passInstances.map((pi) => ({
      id: pi.id,
      templateId: pi.passTemplate.id,
      templateName: pi.passTemplate.name,
      passType: pi.passTemplate.passType,
      status: pi.status,
      data: pi.data,
      walletProvider: pi.walletProvider,
      issuedAt: toISO(pi.issuedAt)!,
      expiresAt: toISO(pi.expiresAt),
    })),
    recentInteractions: contact.interactions.map((i) => ({
      id: i.id,
      type: i.type,
      createdAt: toISO(i.createdAt)!,
      templateName: i.passTemplate.name,
      passType: i.passTemplate.passType,
    })),
    rewards: contact.rewards.map((r) => ({
      id: r.id,
      status: r.status,
      description: r.description,
      earnedAt: toISO(r.earnedAt)!,
      redeemedAt: toISO(r.redeemedAt),
      expiresAt: toISO(r.expiresAt)!,
    })),
  }
}

// ─── Template ──────────────────────────────────────────────

export type ApiTemplate = {
  id: string
  name: string
  description: string | null
  passType: string
  status: string
  config: unknown
  startsAt: string
  endsAt: string | null
  passInstanceCount: number
  createdAt: string
}

export function serializeTemplate(template: {
  id: string
  name: string
  description: string | null
  passType: string
  status: string
  config: unknown
  startsAt: DateLike
  endsAt: DateLike
  createdAt: DateLike
  _count?: { passInstances: number }
}): ApiTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    passType: template.passType,
    status: template.status,
    config: template.config,
    startsAt: toISO(template.startsAt)!,
    endsAt: toISO(template.endsAt),
    passInstanceCount: template._count?.passInstances ?? 0,
    createdAt: toISO(template.createdAt)!,
  }
}

// ─── Template Detail ───────────────────────────────────────

export type ApiTemplateDetail = ApiTemplate & {
  termsAndConditions: string | null
  stats: {
    activeInstances: number
    totalInteractions: number
    availableRewards: number
    redeemedRewards: number
  }
}

export function serializeTemplateDetail(
  template: {
    id: string
    name: string
    description: string | null
    passType: string
    status: string
    config: unknown
    startsAt: DateLike
    endsAt: DateLike
    createdAt: DateLike
    termsAndConditions: string | null
    _count?: { passInstances: number }
  },
  stats: {
    activeInstances: number
    totalInteractions: number
    availableRewards: number
    redeemedRewards: number
  }
): ApiTemplateDetail {
  return {
    ...serializeTemplate(template),
    termsAndConditions: template.termsAndConditions,
    stats,
  }
}

// ─── Pass Instance ─────────────────────────────────────────

export type ApiPassInstance = {
  id: string
  contactId: string
  templateId: string
  templateName: string
  passType: string
  status: string
  data: unknown
  walletProvider: string
  issuedAt: string
  expiresAt: string | null
  createdAt: string
}

export function serializePassInstance(instance: {
  id: string
  contactId: string
  status: string
  data: unknown
  walletProvider: string
  issuedAt: DateLike
  expiresAt: DateLike
  createdAt: DateLike
  passTemplate: {
    id: string
    name: string
    passType: string
  }
}): ApiPassInstance {
  return {
    id: instance.id,
    contactId: instance.contactId,
    templateId: instance.passTemplate.id,
    templateName: instance.passTemplate.name,
    passType: instance.passTemplate.passType,
    status: instance.status,
    data: instance.data,
    walletProvider: instance.walletProvider,
    issuedAt: toISO(instance.issuedAt)!,
    expiresAt: toISO(instance.expiresAt),
    createdAt: toISO(instance.createdAt)!,
  }
}

// ─── Pass Instance Detail ──────────────────────────────────

export type ApiPassInstanceDetail = ApiPassInstance & {
  contact: { id: string; fullName: string; email: string | null }
  recentInteractions: ApiInteractionSummary[]
}

export function serializePassInstanceDetail(instance: {
  id: string
  contactId: string
  status: string
  data: unknown
  walletProvider: string
  issuedAt: DateLike
  expiresAt: DateLike
  createdAt: DateLike
  passTemplate: { id: string; name: string; passType: string }
  contact: { id: string; fullName: string; email: string | null }
  interactions: Array<{
    id: string
    type: string
    createdAt: DateLike
    passTemplate: { name: string; passType: string }
  }>
}): ApiPassInstanceDetail {
  return {
    ...serializePassInstance(instance),
    contact: {
      id: instance.contact.id,
      fullName: instance.contact.fullName,
      email: instance.contact.email,
    },
    recentInteractions: instance.interactions.map((i) => ({
      id: i.id,
      type: i.type,
      createdAt: toISO(i.createdAt)!,
      templateName: i.passTemplate.name,
      passType: i.passTemplate.passType,
    })),
  }
}

// ─── Interaction ───────────────────────────────────────────

export type ApiInteraction = {
  id: string
  type: string
  metadata: unknown
  createdAt: string
  pass: {
    id: string
    templateName: string
    passType: string
    status: string
  } | null
  contact: {
    id: string
    fullName: string
  }
}

export function serializeInteraction(interaction: {
  id: string
  type: string
  metadata: unknown
  createdAt: DateLike
  passInstance: {
    id: string
    status: string
    passTemplate: { name: string; passType: string }
  } | null
  contact: { id: string; fullName: string }
}): ApiInteraction {
  return {
    id: interaction.id,
    type: interaction.type,
    metadata: interaction.metadata,
    createdAt: toISO(interaction.createdAt)!,
    pass: interaction.passInstance
      ? {
          id: interaction.passInstance.id,
          templateName: interaction.passInstance.passTemplate.name,
          passType: interaction.passInstance.passTemplate.passType,
          status: interaction.passInstance.status,
        }
      : null,
    contact: {
      id: interaction.contact.id,
      fullName: interaction.contact.fullName,
    },
  }
}
