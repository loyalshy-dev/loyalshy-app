"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "tabReviews", href: "/dashboard/automations/reviews" },
  { key: "tabWinback", href: "/dashboard/automations/winback" },
] as const

export function AutomationsHeader() {
  const t = useTranslations("dashboard.automations")
  const pathname = usePathname()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>
      <nav className="flex gap-1 border-b border-border" aria-label={t("title")}>
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 pb-2 text-[13px] font-medium transition-colors",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(tab.key)}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
