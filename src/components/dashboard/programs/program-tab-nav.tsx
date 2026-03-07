"use client"

import { useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Rocket, Loader2, ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { activateTemplate as activateProgram } from "@/server/org-settings-actions"
import { statusConfig } from "./program-status"
import { cn } from "@/lib/utils"

type ProgramTabNavProps = {
  templateId: string
  templateName: string
  templateStatus: string
  passType: string
  organizationId: string
  isOwner: boolean
}

type Tab = {
  label: string
  href: string
  ownerOnly?: boolean
}

function getPassesTabLabel(passType: string): string {
  switch (passType) {
    case "TICKET":
      return "Attendees"
    case "MEMBERSHIP":
    case "BUSINESS_ID":
      return "Members"
    case "GIFT_CARD":
      return "Cards"
    default:
      return "Passes"
  }
}

function hasRewardsTab(passType: string): boolean {
  return ["STAMP_CARD", "COUPON", "POINTS"].includes(passType)
}

function getRewardsTabLabel(passType: string): string {
  switch (passType) {
    case "COUPON":
      return "Redemptions"
    case "POINTS":
      return "Catalog"
    default:
      return "Rewards"
  }
}

function getDistributionLabel(_passType: string): string {
  return "Distribution"
}

export function ProgramTabNav({
  templateId,
  templateName,
  templateStatus,
  passType,
  organizationId,
  isOwner,
}: ProgramTabNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isActivating, startTransition] = useTransition()
  const basePath = `/dashboard/programs/${templateId}`

  function handleActivate() {
    startTransition(async () => {
      const result = await activateProgram(organizationId, templateId)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Program activated! Contacts can now receive passes.")
        router.refresh()
      }
    })
  }

  const tabs: Tab[] = [
    { label: "Overview", href: basePath },
    { label: getPassesTabLabel(passType), href: `${basePath}/passes` },
  ]

  if (hasRewardsTab(passType)) {
    tabs.push({
      label: getRewardsTabLabel(passType),
      href: `${basePath}/rewards`,
    })
  }

  tabs.push(
    { label: "Card Design", href: `${basePath}/design`, ownerOnly: true },
    {
      label: getDistributionLabel(passType),
      href: `${basePath}/distribution`,
      ownerOnly: true,
    },
    { label: "Settings", href: `${basePath}/settings`, ownerOnly: true }
  )

  const visibleTabs = tabs.filter((t) => !t.ownerOnly || isOwner)

  function isActive(href: string) {
    if (href === basePath) return pathname === basePath
    return pathname.startsWith(href)
  }

  const cfg = statusConfig[templateStatus] ?? statusConfig.DRAFT

  return (
    <div className="space-y-4">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Back to overview"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight truncate">
          {templateName}
        </h1>
        <Badge
          variant="outline"
          className={`text-[11px] px-1.5 py-0 shrink-0 ${cfg.className}`}
        >
          {cfg.label}
        </Badge>
      </div>

      {/* Draft banner */}
      {templateStatus === "DRAFT" && isOwner && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Rocket className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-[13px] text-muted-foreground truncate">
              This program is in draft mode. Activate it to start issuing
              passes.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={handleActivate}
            disabled={isActivating}
          >
            {isActivating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            Activate
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none">
        {visibleTabs.map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
