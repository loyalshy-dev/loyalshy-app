"use client"

import { Eye, Gift, Trophy, Crown, Ticket, CreditCard, Coins } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { ActivityItem } from "@/server/analytics"
import { Card } from "@/components/ui/card"

const ACTIVITY_CONFIG = {
  interaction: {
    icon: Eye,
    verb: "registered an interaction",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  stamp: {
    icon: Eye,
    verb: "registered a visit",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  check_in: {
    icon: Crown,
    verb: "checked in",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  prepaid_use: {
    icon: CreditCard,
    verb: "used a pass",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  points_earned: {
    icon: Coins,
    verb: "earned points",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  prepaid_recharge: {
    icon: CreditCard,
    verb: "recharged a pass",
    color: "text-success",
    bg: "bg-success/10",
  },
  reward_earned: {
    icon: Gift,
    verb: "earned a reward",
    color: "text-success",
    bg: "bg-success/10",
  },
  reward_redeemed: {
    icon: Trophy,
    verb: "redeemed a reward",
    color: "text-warning",
    bg: "bg-warning/10",
  },
  coupon_redeemed: {
    icon: Ticket,
    verb: "redeemed a coupon",
    color: "text-warning",
    bg: "bg-warning/10",
  },
} as const

type RecentActivityProps = {
  items: ActivityItem[]
}

export function RecentActivity({ items }: RecentActivityProps) {
  if (items.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
          Recent Activity
        </h3>
        <p className="text-sm text-muted-foreground py-8 text-center">
          No activity yet. Register your first interaction to see it here.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
        Recent Activity
      </h3>
      <div className="space-y-0">
        {items.map((item) => {
          const config = ACTIVITY_CONFIG[item.type]
          const Icon = config.icon

          return (
            <div
              key={item.id}
              className="flex items-start gap-3 py-2.5 border-b border-border last:border-0"
            >
              <div
                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${config.bg}`}
              >
                <Icon className={`size-3.5 ${config.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug">
                  <span className="font-medium">{item.contactName}</span>
                  {" "}
                  <span className="text-muted-foreground">{config.verb}</span>
                  {item.detail && (
                    <span className="text-muted-foreground">
                      {" "}&middot; {item.detail}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(item.createdAt), {
                    addSuffix: true,
                  })}
                  {item.staffName && (
                    <span> &middot; by {item.staffName}</span>
                  )}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
