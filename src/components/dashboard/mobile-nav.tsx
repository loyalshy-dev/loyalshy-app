"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, Plus, Users, Layers, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

type MobileNavProps = {
  onOpenRegisterVisit: () => void
  onOpenMore: () => void
}

export function MobileNav({ onOpenRegisterVisit, onOpenMore }: MobileNavProps) {
  const pathname = usePathname()

  function isOverviewActive() {
    return pathname === "/dashboard"
  }

  function isContactsActive() {
    return pathname.startsWith("/dashboard/contacts")
  }

  function isProgramsActive() {
    return pathname.startsWith("/dashboard/programs")
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom"
    >
      <div className="flex items-end justify-around px-2 pt-1 pb-1">
        <Link
          href="/dashboard"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] rounded-md transition-colors",
            isOverviewActive() ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <LayoutGrid
            className={cn("size-5", isOverviewActive() && "text-brand")}
            strokeWidth={isOverviewActive() ? 2 : 1.5}
          />
          <span className="text-[10px] font-medium">Overview</span>
        </Link>

        <Link
          href="/dashboard/contacts"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] rounded-md transition-colors",
            isContactsActive() ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Users
            className={cn("size-5", isContactsActive() && "text-brand")}
            strokeWidth={isContactsActive() ? 2 : 1.5}
          />
          <span className="text-[10px] font-medium">Contacts</span>
        </Link>

        {/* Center FAB — Register Interaction */}
        <div className="flex flex-col items-center justify-center flex-1">
          <button
            type="button"
            onClick={onOpenRegisterVisit}
            className="flex items-center justify-center size-12 -mt-4 rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/25 active:scale-95 transition-transform"
            aria-label="Register Interaction"
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </button>
          <span className="text-[10px] font-medium text-brand mt-0.5">
            Action
          </span>
        </div>

        <Link
          href="/dashboard/programs"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] rounded-md transition-colors",
            isProgramsActive() ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Layers
            className={cn("size-5", isProgramsActive() && "text-brand")}
            strokeWidth={isProgramsActive() ? 2 : 1.5}
          />
          <span className="text-[10px] font-medium">Programs</span>
        </Link>

        <button
          type="button"
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] rounded-md transition-colors text-muted-foreground"
        >
          <MoreHorizontal className="size-5" strokeWidth={1.5} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </nav>
  )
}
