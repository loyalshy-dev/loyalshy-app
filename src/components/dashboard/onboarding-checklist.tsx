"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { dismissOnboardingChecklist } from "@/server/onboarding-registration-actions"
import type { OnboardingChecklistData } from "@/server/onboarding-registration-actions"
import {
  Check,
  Image,
  Gift,
  QrCode,
  Sparkles,
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
  organizationId,
  data,
}: {
  organizationId: string
  data: OnboardingChecklistData
}) {
  const t = useTranslations("dashboard.onboarding")
  const [dismissed, setDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (dismissed || data.isDismissed) return null

  function handleDismiss() {
    startTransition(async () => {
      await dismissOnboardingChecklist(organizationId)
      setDismissed(true)
    })
  }

  // ─── Hero state ────────────────────────────────────────
  // When the org has no program yet, the other 4 checklist items are
  // either impossible (QR + first contact need an active program) or
  // off-path (logo, invite staff). Collapse to a single oversized CTA.
  if (!data.hasProgram) {
    return (
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <button
          onClick={handleDismiss}
          disabled={isPending}
          className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label={t("dismiss")}
        >
          <X className="size-4" />
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
            <Sparkles className="size-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {t("heroTitle")}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              {t("heroBody")}
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0 gap-2">
            <Link href="/dashboard/programs?action=create" prefetch={true}>
              <Gift className="size-4" />
              {t("heroCta")}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const items: ChecklistItem[] = [
    {
      id: "logo",
      label: t("uploadLogo"),
      description: t("uploadLogoDescription"),
      completed: data.hasLogo,
      href: "/dashboard/settings?tab=general",
      icon: Image,
    },
    {
      id: "program",
      label: t("createFirstProgram"),
      description: t("createFirstProgramDescription"),
      completed: data.hasProgram,
      href: data.hasProgram ? "/dashboard/programs" : "/dashboard/programs?action=create",
      icon: Gift,
    },
    {
      id: "qr",
      label: t("printQr"),
      description: t("printQrDescription"),
      completed: data.hasQrPrinted,
      href: "/dashboard/settings/qr-code",
      icon: QrCode,
    },
    {
      id: "contact",
      label: t("firstContact"),
      description: t("firstContactDescription"),
      completed: data.hasContact,
      href: "/dashboard/contacts",
      icon: UserPlus,
    },
    {
      id: "staff",
      label: t("inviteStaff"),
      description: t("inviteStaffDescription"),
      completed: data.hasStaff,
      href: "/dashboard/settings?tab=team",
      icon: Users,
    },
  ]

  const completedCount = items.filter((i) => i.completed).length
  const progress = Math.round((completedCount / items.length) * 100)

  return (
    <div className="rounded-xl border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <Check className="size-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t("title")}</h2>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {items.length} {t("completed")}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          disabled={isPending}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={t("dismiss")}
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
            prefetch={true}
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
            {t("dismiss")}
          </Button>
        </div>
      )}
    </div>
  )
}
