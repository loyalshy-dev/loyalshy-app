"use client"

import { CreditCard, Users, Building2, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Restaurant = {
  id: string
  name: string
  plan: string
  subscriptionStatus: string
}

export function BillingPlaceholder({ restaurant }: { restaurant: Restaurant }) {
  const planLabel = restaurant.plan
  const statusLabel = restaurant.subscriptionStatus

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Current Plan</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your subscription and billing.
          </p>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10">
                <Sparkles className="h-5 w-5 text-brand" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{planLabel} Plan</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {statusLabel}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {restaurant.subscriptionStatus === "TRIALING"
                    ? "You're on a free trial"
                    : "Your subscription renews monthly"}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              Manage Subscription
            </Button>
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Usage</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your current usage and plan limits.
          </p>
        </div>
        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Team Members</p>
                <p className="text-sm font-semibold">— / —</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Customers</p>
                <p className="text-sm font-semibold">— / —</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
        <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="mt-3 text-sm font-medium">Billing setup in progress</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
          Subscription management, invoicing, and the customer portal will be available shortly.
        </p>
      </div>
    </div>
  )
}
