"use client"

import { useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Rocket, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { activateProgram } from "@/server/settings-actions"
import { statusConfig } from "./program-status"
import { cn } from "@/lib/utils"

type ProgramTabNavProps = {
  programId: string
  programName: string
  programStatus: string
  programType: string
  restaurantId: string
  isOwner: boolean
}

type Tab = {
  label: string
  href: string
  ownerOnly?: boolean
}

function getRewardsTabLabel(programType: string): string {
  switch (programType) {
    case "COUPON":
      return "Redemptions"
    case "MEMBERSHIP":
      return "Members"
    case "POINTS":
      return "Catalog"
    default:
      return "Rewards"
  }
}

export function ProgramTabNav({
  programId,
  programName,
  programStatus,
  programType,
  restaurantId,
  isOwner,
}: ProgramTabNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isActivating, startTransition] = useTransition()
  const basePath = `/dashboard/programs/${programId}`

  function handleActivate() {
    startTransition(async () => {
      const result = await activateProgram(restaurantId, programId)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Program activated! Customers can now join.")
        router.refresh()
      }
    })
  }

  const tabs: Tab[] = [
    { label: "Overview", href: basePath },
    { label: getRewardsTabLabel(programType), href: `${basePath}/rewards` },
    { label: "Card Design", href: `${basePath}/design`, ownerOnly: true },
    { label: "QR Code", href: `${basePath}/qr-code`, ownerOnly: true },
    ...(programType === "STAMP_CARD" || programType === "COUPON"
      ? [{ label: "Prize Reveal", href: `${basePath}/prize-reveal`, ownerOnly: true }]
      : []),
    { label: "Settings", href: `${basePath}/settings`, ownerOnly: true },
  ]

  const visibleTabs = tabs.filter((t) => !t.ownerOnly || isOwner)

  function isActive(href: string) {
    if (href === basePath) return pathname === basePath
    return pathname.startsWith(href)
  }

  const cfg = statusConfig[programStatus] ?? statusConfig.DRAFT

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight truncate">
          {programName}
        </h1>
        <Badge
          variant="outline"
          className={`text-[11px] px-1.5 py-0 shrink-0 ${cfg.className}`}
        >
          {cfg.label}
        </Badge>
      </div>

      {/* Draft banner */}
      {programStatus === "DRAFT" && isOwner && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Rocket className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-[13px] text-muted-foreground truncate">
              This program is in draft mode. Activate it to start accepting customers.
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
      <div className="flex gap-1 border-b border-border overflow-x-auto">
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
