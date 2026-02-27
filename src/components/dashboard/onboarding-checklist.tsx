"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { dismissOnboardingChecklist } from "@/server/onboarding-registration-actions"
import type { OnboardingChecklistData } from "@/server/onboarding-registration-actions"
import {
  Check,
  Image,
  Gift,
  QrCode,
  UserPlus,
  Users,
  X,
  ChevronRight,
} from "lucide-react"

type ChecklistItem = {
  id: string
  label: string
  description: string
  completed: boolean
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export function OnboardingChecklist({
  restaurantId,
  data,
}: {
  restaurantId: string
  data: OnboardingChecklistData
}) {
  const [dismissed, setDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (dismissed || data.isDismissed) return null

  const items: ChecklistItem[] = [
    {
      id: "logo",
      label: "Upload your logo",
      description: "Brand your loyalty cards with your restaurant's logo",
      completed: data.hasLogo,
      href: "/dashboard/settings?tab=general",
      icon: Image,
    },
    {
      id: "loyalty",
      label: "Customize your loyalty card",
      description: "Set visits required, reward description, and expiry",
      completed: data.hasCustomLoyalty,
      href: "/dashboard/settings?tab=loyalty",
      icon: Gift,
    },
    {
      id: "qr",
      label: "Print your QR code",
      description: "Download and display your QR code at your counter",
      completed: data.hasQrPrinted,
      href: "/dashboard/settings/qr-code",
      icon: QrCode,
    },
    {
      id: "customer",
      label: "Register your first customer",
      description: "Add a customer or have them scan your QR code",
      completed: data.hasCustomer,
      href: "/dashboard/customers",
      icon: UserPlus,
    },
    {
      id: "staff",
      label: "Invite your staff",
      description: "Add team members to help manage visits",
      completed: data.hasStaff,
      href: "/dashboard/settings?tab=team",
      icon: Users,
    },
  ]

  const completedCount = items.filter((i) => i.completed).length
  const progress = Math.round((completedCount / items.length) * 100)

  function handleDismiss() {
    startTransition(async () => {
      await dismissOnboardingChecklist(restaurantId)
      setDismissed(true)
    })
  }

  return (
    <div className="rounded-xl border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <Check className="size-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Get started with Fidelio</h2>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {items.length} completed
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          disabled={isPending}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Dismiss checklist"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3">
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="p-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50 transition-colors group"
          >
            <div
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                item.completed
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              {item.completed && <Check className="size-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  item.completed ? "text-muted-foreground line-through" : ""
                }`}
              >
                {item.label}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {item.description}
              </p>
            </div>
            {!item.completed && (
              <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </Link>
        ))}
      </div>

      {/* Footer CTA when all done */}
      {completedCount === items.length && (
        <div className="px-5 pb-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleDismiss}
            disabled={isPending}
          >
            All done! Dismiss checklist
          </Button>
        </div>
      )}
    </div>
  )
}
