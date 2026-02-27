"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { statusConfig } from "./program-status"
import { cn } from "@/lib/utils"

type ProgramTabNavProps = {
  programId: string
  programName: string
  programStatus: string
  isOwner: boolean
}

type Tab = {
  label: string
  href: string
  ownerOnly?: boolean
}

export function ProgramTabNav({
  programId,
  programName,
  programStatus,
  isOwner,
}: ProgramTabNavProps) {
  const pathname = usePathname()
  const basePath = `/dashboard/programs/${programId}`

  const tabs: Tab[] = [
    { label: "Overview", href: basePath },
    { label: "Rewards", href: `${basePath}/rewards` },
    { label: "Card Design", href: `${basePath}/design`, ownerOnly: true },
    { label: "QR Code", href: `${basePath}/qr-code`, ownerOnly: true },
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
