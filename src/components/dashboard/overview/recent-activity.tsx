"use client"

import { Eye, Gift, Trophy } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { ActivityItem } from "@/server/analytics"

const ACTIVITY_CONFIG = {
  visit: {
    icon: Eye,
    verb: "registered a visit",
    color: "text-brand",
    bg: "bg-brand/10",
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
} as const

type RecentActivityProps = {
  items: ActivityItem[]
}

export function RecentActivity({ items }: RecentActivityProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
          Recent Activity
        </h3>
        <p className="text-sm text-muted-foreground py-8 text-center">
          No activity yet. Register your first visit to see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
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
                  <span className="font-medium">{item.customerName}</span>
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
    </div>
  )
}
