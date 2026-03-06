"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Layers, MoreHorizontal, Plus, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { label: "Overview", href: "/dashboard", icon: BarChart3 },
  { label: "Contacts", href: "/dashboard/customers", icon: Users },
  // center FAB slot (index 2) handled separately
  { label: "Templates", href: "/dashboard/programs", icon: Layers },
  { label: "More", href: "/dashboard/settings", icon: MoreHorizontal },
]

type MobileNavProps = {
  onOpenRegisterVisit: () => void
}

export function MobileNav({ onOpenRegisterVisit }: MobileNavProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom"
    >
      <div className="flex items-end justify-around px-2 pt-1 pb-1">
        {/* Left tabs */}
        {tabs.slice(0, 2).map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] rounded-md transition-colors",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <tab.icon
                className={cn("size-5", active && "text-brand")}
                strokeWidth={active ? 2 : 1.5}
              />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          )
        })}

        {/* Center FAB — Register Visit */}
        <div className="flex flex-col items-center justify-center flex-1">
          <button
            type="button"
            onClick={onOpenRegisterVisit}
            className="flex items-center justify-center size-12 -mt-4 rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/25 active:scale-95 transition-transform"
            aria-label="Register Visit"
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </button>
          <span className="text-[10px] font-medium text-brand mt-0.5">
            Visit
          </span>
        </div>

        {/* Right tabs */}
        {tabs.slice(2).map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] rounded-md transition-colors",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <tab.icon
                className={cn("size-5", active && "text-brand")}
                strokeWidth={active ? 2 : 1.5}
              />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
