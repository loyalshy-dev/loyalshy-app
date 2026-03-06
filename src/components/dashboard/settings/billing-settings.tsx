"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import type { BillingData } from "@/server/billing-actions"
import { isUpgrade, type PlanId } from "@/lib/plans"

// ─── Plan Card Colors ──────────────────────────────────────

const planAccents: Record<string, string> = {
  STARTER: "bg-brand/10 text-brand",
  GROWTH: "bg-chart-1/10 text-chart-1",
  SCALE: "bg-chart-2/10 text-chart-2",
  ENTERPRISE: "bg-chart-4/10 text-chart-4",
}

const planBorders: Record<string, string> = {
  STARTER: "border-brand/30 ring-1 ring-brand/20",
  GROWTH: "border-chart-1/30",
  SCALE: "border-chart-2/30",
  ENTERPRISE: "border-chart-4/30",
}

// ─── Status Labels ─────────────────────────────────────────

function getStatusBadge(status: string) {
  switch (status) {
    case "TRIALING":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Trial</Badge>
    case "ACTIVE":
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Active</Badge>
    case "PAST_DUE":
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]">Past Due</Badge>
    case "CANCELED":
      return <Badge className="bg-muted text-muted-foreground text-[10px]">Canceled</Badge>
    default:
      return <Badge variant="secondary" className="text-[10px]">{status}</Badge>
  }
}

// ─── Component ─────────────────────────────────────────────

type BillingPeriod = "monthly" | "annual"

export function BillingSettings({ data }: { data: BillingData }) {
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
        toast.error(data.error ?? "Failed to start checkout")
      }
    } catch {
      toast.error("Something went wrong")
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
        toast.error(data.error ?? "Failed to open billing portal")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setPortalLoading(false)
    }
  }

  // Days remaining for trial
  const trialDaysRemaining = organization.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(organization.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <div className="space-y-6">
      {/* Checkout success/canceled banners */}
      {checkoutStatus === "success" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <p className="text-sm text-emerald-700">Subscription activated! Your plan has been updated.</p>
          </div>
          <button onClick={dismissCheckout} className="text-xs text-muted-foreground hover:text-foreground">
            Dismiss
          </button>
        </div>
      )}

      {checkoutStatus === "canceled" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">Checkout was canceled. No changes were made.</p>
          <button onClick={dismissCheckout} className="text-xs text-muted-foreground hover:text-foreground">
            Dismiss
          </button>
        </div>
      )}

      {/* Trial Banner */}
      {organization.subscriptionStatus === "TRIALING" && trialDaysRemaining !== null && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">
            <strong>{trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""}</strong> remaining in your trial.
            Upgrade to keep all your features.
          </p>
        </div>
      )}

      {/* Past Due Banner */}
      {organization.subscriptionStatus === "PAST_DUE" && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-700 font-medium">Payment failed</p>
            <p className="text-xs text-red-600/80 mt-0.5">
              Please update your payment method to avoid service interruption.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/30 text-red-700 hover:bg-red-500/10"
            onClick={handleManageBilling}
            disabled={portalLoading}
          >
            {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update Payment"}
          </Button>
        </div>
      )}

      {/* Current Plan */}
      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Current Plan</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your subscription and billing.
          </p>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${planAccents[currentPlan] ?? planAccents.STARTER}`}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">
                    {plans[currentPlan as keyof typeof plans]?.name ?? currentPlan} Plan
                  </p>
                  {getStatusBadge(organization.subscriptionStatus)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {organization.subscriptionStatus === "TRIALING"
                    ? `Trial ends in ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""}`
                    : organization.subscriptionStatus === "CANCELED"
                      ? "Subscribe to continue using Loyalshy"
                      : "Your subscription renews monthly"}
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
                Manage Billing
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Usage */}
      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Usage</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your current usage and plan limits.
          </p>
        </div>
        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Contacts */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Contacts</p>
                  <p className="text-sm font-semibold">
                    {usage.contacts.toLocaleString()} / {usage.contactLimit === Infinity ? "Unlimited" : usage.contactLimit.toLocaleString()}
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
                    <p className="text-[10px] text-amber-600 mt-1">Approaching limit</p>
                  )}
                  {usage.contactPercent >= 100 && (
                    <p className="text-[10px] text-red-600 mt-1">Limit reached — upgrade to add more</p>
                  )}
                </div>
              )}
            </div>

            {/* Staff */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Team Members</p>
                  <p className="text-sm font-semibold">
                    {usage.staff} / {usage.staffLimit === Infinity ? "Unlimited" : usage.staffLimit}
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
                    <p className="text-[10px] text-amber-600 mt-1">Approaching limit</p>
                  )}
                  {usage.staffPercent >= 100 && (
                    <p className="text-[10px] text-red-600 mt-1">Limit reached — upgrade to add more</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Plans</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose the plan that fits your business.
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
                Monthly
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
                Annual
              </button>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                      <Badge variant="secondary" className="text-[10px]">Current</Badge>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>

                  <div className="mt-3 mb-4">
                    {displayPrice === null ? (
                      <p className="text-2xl font-bold tracking-tight">Custom</p>
                    ) : (
                      <>
                        <p className="text-2xl font-bold tracking-tight">{displayPrice}€<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                        {billingPeriod === "annual" && plan.price !== null && (
                          <p className="text-[10px] text-emerald-600 mt-0.5">
                            Save {(plan.price - (plan.annualPrice ?? 0)) * 12}€/year
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <ul className="space-y-2 mb-5 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button variant="outline" size="sm" disabled className="w-full">
                      Current Plan
                    </Button>
                  ) : isEnterprise ? (
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <a href="mailto:sales@loyalshy.com">
                        Contact Us
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
                          Upgrade
                          <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                        </>
                      ) : (
                        "Downgrade"
                      )}
                    </Button>
                  ) : lookupKey ? (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleUpgrade(lookupKey)}
                      disabled={loadingPlan === lookupKey}
                    >
                      {loadingPlan === lookupKey ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          Subscribe
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
