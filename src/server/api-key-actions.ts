"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"
import { assertAuthenticated, assertOrganizationRole, getOrganizationForUser } from "@/lib/dal"
import { db } from "@/lib/db"
import { generateApiKey } from "@/lib/api-keys"
import { PLANS } from "@/lib/plans"
import type { PlanId } from "@/lib/plans"

// ─── API Keys ───────────────────────────────────────────────

export type ApiKeyListItem = {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

export async function listApiKeys(): Promise<ApiKeyListItem[]> {
  const session = await assertAuthenticated()
  const org = await getOrganizationForUser()
  if (!org) return []
  await assertOrganizationRole(org.id, "owner")

  const keys = await db.apiKey.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  })

  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }))
}

export async function createApiKey(
  name: string,
  expiresAt?: string
): Promise<{ success: true; fullKey: string; keyId: string } | { success: false; error: string }> {
  const session = await assertAuthenticated()
  const org = await getOrganizationForUser()
  if (!org) return { success: false, error: "No organization found." }
  await assertOrganizationRole(org.id, "owner")

  const plan = PLANS[org.plan as PlanId]
  if (!plan.apiAccess) {
    return { success: false, error: "API access is not available on your current plan." }
  }

  const currentCount = await db.apiKey.count({
    where: { organizationId: org.id, revokedAt: null },
  })
  if (currentCount >= plan.apiKeyLimit) {
    return { success: false, error: `Maximum ${plan.apiKeyLimit} API keys allowed on your ${plan.name} plan.` }
  }

  const { fullKey, keyPrefix, keyHash } = generateApiKey()

  const key = await db.apiKey.create({
    data: {
      organizationId: org.id,
      name: name.trim() || "Untitled key",
      keyPrefix,
      keyHash,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdById: session.user.id,
    },
  })

  revalidatePath("/dashboard/settings")
  return { success: true, fullKey, keyId: key.id }
}

export async function revokeApiKey(
  keyId: string
): Promise<{ success: boolean; error?: string }> {
  await assertAuthenticated()
  const org = await getOrganizationForUser()
  if (!org) return { success: false, error: "No organization found." }
  await assertOrganizationRole(org.id, "owner")

  const key = await db.apiKey.findFirst({
    where: { id: keyId, organizationId: org.id },
  })
  if (!key) return { success: false, error: "API key not found." }
  if (key.revokedAt) return { success: false, error: "Key already revoked." }

  await db.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  })

  revalidatePath("/dashboard/settings")
  return { success: true }
}

// ─── Webhook Endpoints ──────────────────────────────────────

export type WebhookEndpointListItem = {
  id: string
  url: string
  events: string[]
  enabled: boolean
  failureCount: number
  lastDeliveryAt: string | null
  createdAt: string
}

export async function listWebhookEndpoints(): Promise<WebhookEndpointListItem[]> {
  await assertAuthenticated()
  const org = await getOrganizationForUser()
  if (!org) return []
  await assertOrganizationRole(org.id, "owner")

  const endpoints = await db.webhookEndpoint.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      events: true,
      enabled: true,
      failureCount: true,
      lastDeliveryAt: true,
      createdAt: true,
    },
  })

  return endpoints.map((e) => ({
    id: e.id,
    url: e.url,
    events: e.events,
    enabled: e.enabled,
    failureCount: e.failureCount,
    lastDeliveryAt: e.lastDeliveryAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  }))
}

export async function createWebhookEndpoint(
  url: string,
  events: string[]
): Promise<{ success: true; id: string; secret: string } | { success: false; error: string }> {
  await assertAuthenticated()
  const org = await getOrganizationForUser()
  if (!org) return { success: false, error: "No organization found." }
  await assertOrganizationRole(org.id, "owner")

  const plan = PLANS[org.plan as PlanId]
  if (!plan.apiAccess) {
    return { success: false, error: "API access is not available on your current plan." }
  }

  const currentCount = await db.webhookEndpoint.count({
    where: { organizationId: org.id },
  })
  if (currentCount >= plan.webhookEndpointLimit) {
    return { success: false, error: `Maximum ${plan.webhookEndpointLimit} webhook endpoints allowed on your ${plan.name} plan.` }
  }

  if (!url.startsWith("https://")) {
    return { success: false, error: "Webhook URL must use HTTPS." }
  }

  const secret = randomBytes(32).toString("hex")

  const endpoint = await db.webhookEndpoint.create({
    data: {
      organizationId: org.id,
      url,
      events,
      secret,
    },
  })

  revalidatePath("/dashboard/settings")
  return { success: true, id: endpoint.id, secret }
}

export async function updateWebhookEndpoint(
  id: string,
  data: { url?: string; events?: string[]; enabled?: boolean }
): Promise<{ success: boolean; error?: string }> {
  await assertAuthenticated()
  const org = await getOrganizationForUser()
  if (!org) return { success: false, error: "No organization found." }
  await assertOrganizationRole(org.id, "owner")

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id, organizationId: org.id },
  })
  if (!endpoint) return { success: false, error: "Webhook endpoint not found." }

  const updateData: Record<string, unknown> = {}
  if (data.url !== undefined) updateData.url = data.url
  if (data.events !== undefined) updateData.events = data.events
  if (data.enabled !== undefined) {
    updateData.enabled = data.enabled
    if (data.enabled && !endpoint.enabled) {
      updateData.failureCount = 0
    }
  }

  await db.webhookEndpoint.update({ where: { id }, data: updateData })
  revalidatePath("/dashboard/settings")
  return { success: true }
}

export async function deleteWebhookEndpoint(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await assertAuthenticated()
  const org = await getOrganizationForUser()
  if (!org) return { success: false, error: "No organization found." }
  await assertOrganizationRole(org.id, "owner")

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id, organizationId: org.id },
  })
  if (!endpoint) return { success: false, error: "Webhook endpoint not found." }

  await db.webhookEndpoint.delete({ where: { id } })
  revalidatePath("/dashboard/settings")
  return { success: true }
}

export async function rotateWebhookSecret(
  id: string
): Promise<{ success: true; secret: string } | { success: false; error: string }> {
  await assertAuthenticated()
  const org = await getOrganizationForUser()
  if (!org) return { success: false, error: "No organization found." }
  await assertOrganizationRole(org.id, "owner")

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id, organizationId: org.id },
  })
  if (!endpoint) return { success: false, error: "Webhook endpoint not found." }

  const newSecret = randomBytes(32).toString("hex")
  await db.webhookEndpoint.update({
    where: { id },
    data: { secret: newSecret, failureCount: 0 },
  })

  revalidatePath("/dashboard/settings")
  return { success: true, secret: newSecret }
}
