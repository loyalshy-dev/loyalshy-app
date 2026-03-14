"use client"

import {
  Stamp,
  Gift,
  Trophy,
  Crown,
  Ticket,
  CreditCard,
  Coins,
  CalendarDays,
  ShieldCheck,
  Bus,
  BadgeCheck,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useTranslations } from "next-intl"
import type { ActivityItem } from "@/server/analytics"
import { Card } from "@/components/ui/card"

type ActivityVerbKey = "stamp" | "checkIn" | "passUse" | "pointsEarn" | "recharge" | "giftUse" | "ticketScan" | "access" | "board" | "verify" | "rewardEarned" | "rewardRedeemed" | "couponRedeemed"

const ACTIVITY_CONFIG: Record<
  ActivityItem["type"],
  { icon: typeof Stamp; verbKey: ActivityVerbKey; color: string; bg: string }
> = {
  stamp: {
    icon: Stamp,
    verbKey: "stamp",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  check_in: {
    icon: Crown,
    verbKey: "checkIn",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  prepaid_use: {
    icon: CreditCard,
    verbKey: "passUse",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  points_earned: {
    icon: Coins,
    verbKey: "pointsEarn",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  prepaid_recharge: {
    icon: CreditCard,
    verbKey: "recharge",
    color: "text-success",
    bg: "bg-success/10",
  },
  gift_charge: {
    icon: Gift,
    verbKey: "giftUse",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  ticket_scan: {
    icon: CalendarDays,
    verbKey: "ticketScan",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  access_grant: {
    icon: ShieldCheck,
    verbKey: "access",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  transit_board: {
    icon: Bus,
    verbKey: "board",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  id_verify: {
    icon: BadgeCheck,
    verbKey: "verify",
    color: "text-brand",
    bg: "bg-brand/10",
  },
  reward_earned: {
    icon: Gift,
    verbKey: "rewardEarned",
    color: "text-success",
    bg: "bg-success/10",
  },
  reward_redeemed: {
    icon: Trophy,
    verbKey: "rewardRedeemed",
    color: "text-warning",
    bg: "bg-warning/10",
  },
  coupon_redeemed: {
    icon: Ticket,
    verbKey: "couponRedeemed",
    color: "text-warning",
    bg: "bg-warning/10",
  },
}

type RecentActivityProps = {
  items: ActivityItem[]
}

export function RecentActivity({ items }: RecentActivityProps) {
  const t = useTranslations("dashboard.activity")

  if (items.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
          {t("title")}
        </h3>
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("empty")}
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
        {t("title")}
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
                  <span className="text-muted-foreground">{t(config.verbKey)}</span>
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
                    <span> &middot; {t("by")} {item.staffName}</span>
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
