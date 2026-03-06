"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, Plus, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

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
        <Link
          href="/dashboard"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] rounded-md transition-colors",
            isActive("/dashboard") && !pathname.startsWith("/dashboard/settings")
              ? "text-foreground"
              : "text-muted-foreground"
          )}
        >
          <LayoutGrid
            className={cn(
              "size-5",
              isActive("/dashboard") && !pathname.startsWith("/dashboard/settings") && "text-brand"
            )}
            strokeWidth={isActive("/dashboard") && !pathname.startsWith("/dashboard/settings") ? 2 : 1.5}
          />
          <span className="text-[10px] font-medium">Overview</span>
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
          href="/dashboard/settings"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] rounded-md transition-colors",
            isActive("/dashboard/settings") ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Settings
            className={cn("size-5", isActive("/dashboard/settings") && "text-brand")}
            strokeWidth={isActive("/dashboard/settings") ? 2 : 1.5}
          />
          <span className="text-[10px] font-medium">Settings</span>
        </Link>
      </div>
    </nav>
  )
}
