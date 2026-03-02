"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import {
  Building2,
  ExternalLink,
  Layers,
  Loader2,
  Users,
  UserCheck,
} from "lucide-react"
import type { AdminRestaurantDetail } from "@/server/admin-actions"
import { getAdminRestaurantDetail } from "@/server/admin-actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success border-success/20",
  TRIALING: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  PAST_DUE: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  CANCELED: "bg-muted text-muted-foreground",
}

const statusLabels: Record<string, string> = {
  ACTIVE: "Active",
  TRIALING: "Trialing",
  PAST_DUE: "Past Due",
  CANCELED: "Canceled",
}

const planStyles: Record<string, string> = {
  STARTER: "bg-muted text-muted-foreground",
  PRO: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  BUSINESS: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  ENTERPRISE: "bg-amber-500/10 text-amber-600 border-amber-500/20",
}

const orgRoleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
}

type AdminRestaurantDetailSheetProps = {
  restaurantId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminRestaurantDetailSheet({
  restaurantId,
  open,
  onOpenChange,
}: AdminRestaurantDetailSheetProps) {
  const [detail, setDetail] = useState<AdminRestaurantDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!restaurantId || !open) return
    setLoading(true)
    getAdminRestaurantDetail(restaurantId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [restaurantId, open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 overflow-hidden flex flex-col">
        {loading || !detail ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Header */}
              <SheetHeader className="p-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-base truncate">
                      {detail.name}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground truncate">
                      {detail.slug}
                    </p>
                  </div>
                </div>
              </SheetHeader>

              {/* Subscription card */}
              <div className="px-6 pb-4">
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Subscription
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${planStyles[detail.plan] ?? ""}`}
                      >
                        {detail.plan}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${statusStyles[detail.subscriptionStatus] ?? ""}`}
                      >
                        {statusLabels[detail.subscriptionStatus] ?? detail.subscriptionStatus}
                      </Badge>
                    </div>
                  </div>
                  {detail.stripeCustomerId && (
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {detail.stripeCustomerId}
                    </p>
                  )}
                  {detail.trialEndsAt && (
                    <p className="text-xs text-muted-foreground">
                      Trial ends: {format(new Date(detail.trialEndsAt), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="px-6 pb-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3 text-center">
                  <Users className="size-3.5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-semibold tabular-nums">
                    {detail._count.users}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Users</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <Layers className="size-3.5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-semibold tabular-nums">
                    {detail._count.loyaltyPrograms}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Programs</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <UserCheck className="size-3.5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-semibold tabular-nums">
                    {detail._count.customers}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Customers</p>
                </div>
              </div>

              {/* Info */}
              <div className="px-6 pb-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Created
                  </p>
                  <p className="text-sm mt-0.5">
                    {format(new Date(detail.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>

              {/* Users list */}
              <div className="px-6 pb-6">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Team Members
                </p>
                {detail.users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No team members.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.users.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-md border border-border bg-muted/30"
                      >
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[10px]">
                            {getInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium truncate">
                            {u.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {u.email}
                          </p>
                        </div>
                        {u.orgRole && (
                          <Badge variant="outline" className="text-[11px] shrink-0">
                            {orgRoleLabels[u.orgRole] ?? u.orgRole}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            {detail.stripeCustomerId && (
              <div className="shrink-0 p-4 border-t border-border">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://dashboard.stripe.com/customers/${detail.stripeCustomerId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-3.5" />
                    View in Stripe
                  </a>
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
