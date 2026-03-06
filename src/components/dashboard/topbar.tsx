"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type TopbarProps = {
  onOpenCommandPalette: () => void
  onOpenRegisterVisit: () => void
}

const breadcrumbLabels: Record<string, string> = {
  dashboard: "Overview",
  customers: "Contacts",
  rewards: "Rewards",
  programs: "Templates",
  settings: "Settings",
  design: "Card Design",
  "qr-code": "QR Code",
}

// UUID v7 pattern (8-4-4-4-12 hex)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function Topbar({
  onOpenCommandPalette,
  onOpenRegisterVisit,
}: TopbarProps) {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  return (
    <header className="flex items-center justify-between gap-4 h-14 px-4 lg:px-6 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />

        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            {segments
              .filter((segment) => !uuidRegex.test(segment))
              .map((segment, i, filtered) => {
                const isLast = i === filtered.length - 1
                const label = breadcrumbLabels[segment] ?? segment
                // Build href from original segments up to this segment's position
                const originalIndex = segments.indexOf(segment)
                const href = "/" + segments.slice(0, originalIndex + 1).join("/")

                return (
                  <React.Fragment key={segment}>
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className="text-[13px] font-medium">
                          {label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href={href}
                          className="text-[13px] text-muted-foreground hover:text-foreground"
                        >
                          {label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </React.Fragment>
                )
              })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2">
        {/* Command palette trigger */}
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex gap-2 text-muted-foreground font-normal"
          onClick={onOpenCommandPalette}
        >
          <Search className="size-3.5" />
          <span className="text-[13px]">Search...</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">&#8984;</span>K
          </kbd>
        </Button>

        {/* Mobile search */}
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={onOpenCommandPalette}
          aria-label="Search"
        >
          <Search className="size-4" />
        </Button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Register Visit CTA */}
        <Button size="sm" className="gap-1.5" onClick={onOpenRegisterVisit}>
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">New Interaction</span>
        </Button>
      </div>
    </header>
  )
}
