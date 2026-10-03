"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  CreditCard,
  Users,
  Building2,
  Sparkles,
  Check,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  Loader2,
  Layers,
  Megaphone,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import type { BillingData } from "@/server/billing-actions"
import { isUpgrade, type PlanId } from "@/lib/plans"

// ─── Plan Card Colors ──────────────────────────────────────

const planAccents: Record<string, string> = {
  FREE: "bg-muted text-muted-foreground",
  STARTER: "bg-brand/10 text-brand",
  GROWTH: "bg-brand/10 text-brand",
  SCALE: "bg-brand/10 text-brand",
  ENTERPRISE: "bg-brand/10 text-brand",
}

const planBorders: Record<string, string> = {
  STARTER: "border-brand/30 ring-1 ring-brand/20",
  GROWTH: "border-brand/30 ring-1 ring-brand/20",
  SCALE: "border-brand/30 ring-1 ring-brand/20",
  ENTERPRISE: "border-brand/30 ring-1 ring-brand/20",
}

// Plan copy (name, description, features) comes from the landing's
// `pricing` namespace so billing and the pricing page always say the same.
const PRICING_KEYS = {
  FREE: "free",
  STARTER: "starter",
  GROWTH: "growth",
  SCALE: "scale",
  ENTERPRISE: "enterprise",
} as const satisfies Record<PlanId, string>

// ─── Status Labels ─────────────────────────────────────────

function StatusBadge({ status, t }: { status: string; t: ReturnType<typeof useTranslations> }) {
  switch (status) {
    case "TRIALING":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">{t("statusTrial")}</Badge>
    case "ACTIVE":
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">{t("statusActive")}</Badge>
    case "PAST_DUE":
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]">{t("statusPastDue")}</Badge>
    case "CANCELED":
      return <Badge className="bg-muted text-muted-foreground text-[10px]">{t("statusCanceled")}</Badge>
    default:
      return <Badge variant="secondary" className="text-[10px]">{status}</Badge>
  }
}

// ─── Component ─────────────────────────────────────────────

type BillingPeriod = "monthly" | "annual"

export function BillingSettings({ data }: { data: BillingData }) {
  const t = useTranslations("dashboard.settingsForms")
  const tp = useTranslations("pricing")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly")

  const { organization, usage, plans } = data
  const currentPlan = organization.plan as PlanId
  const hasActiveSubscription = !!organization.stripeSubscriptionId &&
    (organization.subscriptionStatus === "ACTIVE" || organization.subscriptionStatus === "TRIALING")

  const checkoutStatus = searchParams.get("checkout")

  // Dismiss checkout status params
  function dismissCheckout() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("checkout")
    params.set("tab", "billing")
    router.replace(`/dashboard/settings?${params.toString()}`)
  }

  // Upgrade / subscribe
  async function handleUpgrade(lookupKey: string) {
    setLoadingPlan(lookupKey)
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceLookupKey: lookupKey }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error ?? t("billingCheckoutFailed"))
      }
    } catch {
      toast.error(t("billingGenericError"))
    } finally {
      setLoadingPlan(null)
    }
  }

  // Manage billing
  async function handleManageBilling() {
    setPortalLoading(true)
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error ?? t("billingPortalFailed"))
      }
    } catch {
      toast.error(t("billingGenericError"))
    } finally {
      setPortalLoading(false)
    }
  }

  // Days remaining for trial
  const trialDaysRemaining = organization.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(organization.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const planName = (planId: PlanId) => tp(`${PRICING_KEYS[planId]}.name`)
  const planDescription = (planId: PlanId) => tp(`${PRICING_KEYS[planId]}.description`)
  const planFeatures = (planId: PlanId): string[] =>
    planId === "ENTERPRISE"
      ? Object.values(t.raw("billingEnterpriseFeatures") as Record<string, string>)
      : Object.values(tp.raw(`${PRICING_KEYS[planId]}.features`) as Record<string, string>)

  return (
    <div className="space-y-6">
      {/* Checkout success/canceled banners */}
      {checkoutStatus === "success" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <p className="text-sm text-emerald-700">{t("billingCheckoutSuccess")}</p>
          </div>
          <button onClick={dismissCheckout} className="text-xs text-muted-foreground hover:text-foreground">
            {t("billingDismiss")}
          </button>
        </div>
      )}

      {checkoutStatus === "canceled" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">{t("billingCheckoutCanceled")}</p>
          <button onClick={dismissCheckout} className="text-xs text-muted-foreground hover:text-foreground">
            {t("billingDismiss")}
          </button>
        </div>
      )}

      {/* Trial Banner */}
      {organization.subscriptionStatus === "TRIALING" && trialDaysRemaining !== null && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">
            {t.rich("billingTrialBanner", {
              days: trialDaysRemaining,
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
      )}

      {/* Past Due Banner */}
      {organization.subscriptionStatus === "PAST_DUE" && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-700 font-medium">{t("billingPaymentFailedTitle")}</p>
            <p className="text-xs text-red-600/80 mt-0.5">
              {t("billingPaymentFailedBody")}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/30 text-red-700 hover:bg-red-500/10"
            onClick={handleManageBilling}
            disabled={portalLoading}
          >
            {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("billingUpdatePayment")}
          </Button>
        </div>
      )}

      {/* Current Plan */}
      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">{t("currentPlan")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("manageBillingDescription")}
          </p>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${planAccents[currentPlan] ?? planAccents.STARTER}`}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">
                    {t("billingPlanName", { name: planName(currentPlan) })}
                  </p>
                  <StatusBadge status={organization.subscriptionStatus} t={t} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {organization.subscriptionStatus === "TRIALING"
                    ? t("billingTrialEnds", { days: trialDaysRemaining ?? 0 })
                    : organization.subscriptionStatus === "CANCELED"
                      ? t("billingSubscribeToContinue")
                      : currentPlan === "FREE"
                        ? t("billingFreeForever")
                        : t("billingRenews")}
                </p>
              </div>
            </div>
            {organization.stripeCustomerId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageBilling}
                disabled={portalLoading}
              >
                {portalLoading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("manageBilling")}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Usage */}
      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">{t("usage")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("usageDescription")}
          </p>
        </div>
        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Contacts */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{t("contactsLabel")}</p>
                  <p className="text-sm font-semibold">
                    {usage.contacts.toLocaleString()} / {usage.contactLimit === Infinity ? t("unlimited") : usage.contactLimit.toLocaleString()}
                  </p>
                </div>
              </div>
              {usage.contactLimit !== Infinity && (
                <div className="mt-3">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usage.contactPercent >= 100
                          ? "bg-red-500"
                          : usage.contactPercent >= 80
                            ? "bg-amber-500"
                            : "bg-brand"
                      }`}
                      style={{ width: `${Math.min(usage.contactPercent, 100)}%` }}
                    />
                  </div>
                  {usage.contactPercent >= 80 && usage.contactPercent < 100 && (
                    <p className="text-[10px] text-amber-600 mt-1">{t("approachingLimit")}</p>
                  )}
                  {usage.contactPercent >= 100 && (
                    <p className="text-[10px] text-red-600 mt-1">{t("contactLimitReached")}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">{t("contactsHint")}</p>
                </div>
              )}
            </div>

            {/* Staff */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{t("teamMembersLabel")}</p>
                  <p className="text-sm font-semibold">
                    {usage.staff} / {usage.staffLimit === Infinity ? t("unlimited") : usage.staffLimit}
                  </p>
                </div>
              </div>
              {usage.staffLimit !== Infinity && (
                <div className="mt-3">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usage.staffPercent >= 100
                          ? "bg-red-500"
                          : usage.staffPercent >= 80
                            ? "bg-amber-500"
                            : "bg-brand"
                      }`}
                      style={{ width: `${Math.min(usage.staffPercent, 100)}%` }}
                    />
                  </div>
                  {usage.staffPercent >= 80 && usage.staffPercent < 100 && (
                    <p className="text-[10px] text-amber-600 mt-1">{t("approachingLimit")}</p>
                  )}
                  {usage.staffPercent >= 100 && (
                    <p className="text-[10px] text-red-600 mt-1">{t("staffLimitReached")}</p>
                  )}
                </div>
              )}
            </div>

            {/* Programs */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{t("programsLabel")}</p>
                  <p className="text-sm font-semibold">
                    {usage.programs} / {usage.programLimit === Infinity ? t("unlimited") : usage.programLimit}
                  </p>
                </div>
              </div>
              {usage.programLimit !== Infinity && (
                <div className="mt-3">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usage.programPercent >= 100
                          ? "bg-red-500"
                          : usage.programPercent >= 80
                            ? "bg-amber-500"
                            : "bg-brand"
                      }`}
                      style={{ width: `${Math.min(usage.programPercent, 100)}%` }}
                    />
                  </div>
                  {usage.programPercent >= 80 && usage.programPercent < 100 && (
                    <p className="text-[10px] text-amber-600 mt-1">{t("approachingLimit")}</p>
                  )}
                  {usage.programPercent >= 100 && (
                    <p className="text-[10px] text-red-600 mt-1">{t("programLimitReached")}</p>
                  )}
                </div>
              )}
            </div>

            {/* Announcements (per org, shared across programs) */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Megaphone className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{t("announcementsLabel")}</p>
                  <p className="text-sm font-semibold">
                    {usage.announcements.used} / {usage.announcements.limit === null ? t("unlimited") : usage.announcements.limit}
                  </p>
                </div>
              </div>
              {usage.announcements.limit !== null && (
                <div className="mt-3">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usage.announcements.remaining === 0 ? "bg-red-500" : "bg-brand"
                      }`}
                      style={{
                        width: `${Math.min((usage.announcements.used / usage.announcements.limit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  {usage.announcements.remaining === 0 && (
                    <p className="text-[10px] text-red-600 mt-1">{t("announcementsLimitReached")}</p>
                  )}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                {usage.announcements.period === "lifetime"
                  ? t("announcementsHintLifetime")
                  : t("announcementsHintWeek")}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">{t("plansSection")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("plansDescription")}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setBillingPeriod("monthly")}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                  billingPeriod === "monthly"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tp("monthly")}
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod("annual")}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                  billingPeriod === "annual"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tp("annual")}
              </button>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Free plan card */}
            <div
              className={`rounded-lg border p-5 flex flex-col ${
                currentPlan === "FREE"
                  ? "border-muted-foreground/30 ring-1 ring-muted-foreground/20"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-muted text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                </span>
                {currentPlan === "FREE" && (
                  <Badge variant="secondary" className="text-[10px]">{t("billingCurrentBadge")}</Badge>
                )}
              </div>

              <h3 className="text-sm font-semibold">{planName("FREE")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{planDescription("FREE")}</p>

              <div className="mt-3 mb-4">
                <p className="text-2xl font-bold tracking-tight">0€<span className="text-sm font-normal text-muted-foreground">{t("billingPerMonth")}</span></p>
              </div>

              <ul className="space-y-2 mb-5 flex-1">
                {planFeatures("FREE").map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button variant="outline" size="sm" disabled className="w-full">
                {t("billingFreeForeverButton")}
              </Button>
            </div>

            {(["STARTER", "GROWTH", "SCALE", "ENTERPRISE"] as const).map((planId) => {
              const plan = plans[planId]
              const isCurrent = currentPlan === planId
              const isEnterprise = planId === "ENTERPRISE"
              const lookupKey = isEnterprise ? null : `${planId.toLowerCase()}_${billingPeriod}`
              const displayPrice = billingPeriod === "annual" ? plan.annualPrice : plan.price

              return (
                <div
                  key={planId}
                  className={`rounded-lg border p-5 flex flex-col ${
                    isCurrent
                      ? planBorders[planId] ?? "border-brand/30 ring-1 ring-brand/20"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${planAccents[planId] ?? planAccents.STARTER}`}>
                      <Sparkles className="h-4 w-4" />
                    </span>
                    {isCurrent && (
                      <Badge variant="secondary" className="text-[10px]">{t("billingCurrentBadge")}</Badge>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold">{planName(planId)}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{planDescription(planId)}</p>

                  <div className="mt-3 mb-4">
                    {displayPrice === null ? (
                      <p className="text-2xl font-bold tracking-tight">{t("billingPriceCustom")}</p>
                    ) : (
                      <>
                        <p className="text-2xl font-bold tracking-tight">{displayPrice}€<span className="text-sm font-normal text-muted-foreground">{t("billingPerMonth")}</span></p>
                        {billingPeriod === "annual" && plan.price !== null && (
                          <p className="text-[10px] text-emerald-600 mt-0.5">
                            {t("billingSavePerYear", { amount: (plan.price - (plan.annualPrice ?? 0)) * 12 })}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <ul className="space-y-2 mb-5 flex-1">
                    {planFeatures(planId).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button variant="outline" size="sm" disabled className="w-full">
                      {t("billingCurrentPlanButton")}
                    </Button>
                  ) : isEnterprise ? (
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <a href="mailto:sales@loyalshy.com">
                        {t("billingContactUs")}
                        <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : hasActiveSubscription ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                    >
                      {portalLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isUpgrade(currentPlan, planId) ? (
                        <>
                          {t("billingUpgrade")}
                          <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                        </>
                      ) : (
                        t("billingDowngrade")
                      )}
                    </Button>
                  ) : lookupKey ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleUpgrade(lookupKey)}
                      disabled={loadingPlan === lookupKey}
                    >
                      {loadingPlan === lookupKey ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          {t("billingSubscribe")}
                          <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}
