"use client"

import { formatDistanceToNow } from "date-fns"
import { Stamp, Ticket, Crown, Coins, CreditCard } from "lucide-react"
import type { TopContactItem } from "@/server/analytics"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

// Deterministic color from name
function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `oklch(0.55 0.12 ${hue})`
}

const typeIcons: Record<string, typeof Stamp> = {
  STAMP_CARD: Stamp,
  COUPON: Ticket,
  MEMBERSHIP: Crown,
  POINTS: Coins,
  PREPAID: CreditCard,
}

type TopContactsProps = {
  contacts: TopContactItem[]
}

export function TopContacts({ contacts }: TopContactsProps) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
          Top Contacts
        </h3>
        <p className="text-sm text-muted-foreground py-8 text-center">
          No contacts yet
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
        Top Contacts
      </h3>
      <div className="space-y-0">
        {contacts.map((contact) => {
          const TypeIcon = contact.primaryPassType
            ? typeIcons[contact.primaryPassType]
            : null

          return (
            <div
              key={contact.id}
              className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
            >
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white"
                style={{ backgroundColor: getAvatarColor(contact.fullName) }}
              >
                {getInitials(contact.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate">
                  {contact.fullName}
                </p>
                {contact.lastInteractionAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Last interaction{" "}
                    {formatDistanceToNow(new Date(contact.lastInteractionAt), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {TypeIcon && (
                  <TypeIcon className="size-3 text-muted-foreground/60" />
                )}
                <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                  {contact.engagementLabel}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
