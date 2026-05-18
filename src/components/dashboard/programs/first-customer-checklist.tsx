"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  Sparkles,
  FileText,
  Share2,
  Smartphone,
  UserPlus,
  ArrowRight,
} from "lucide-react"

type Item = {
  id: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  href: string
  /** External (full route) vs in-page anchor */
  external?: boolean
}

/**
 * Empty-state guide for the distribution page. Shown when totalIssued === 0
 * to replace the all-zeros DistributionStats and give the merchant a clear
 * "do these four things" sequence. Items 1, 2, 4 anchor-scroll to the
 * relevant section on the same page; item 3 deep-links to settings with
 * ?connect=1 to auto-open the Connect Device dialog.
 */
export function FirstCustomerChecklist() {
  const t = useTranslations("dashboard.distribution.firstCustomer")

  const items: Item[] = [
    {
      id: "qr",
      icon: FileText,
      label: t("qrLabel"),
      description: t("qrDescription"),
      href: "#qr-section",
    },
    {
      id: "share",
      icon: Share2,
      label: t("shareLabel"),
      description: t("shareDescription"),
      href: "#share-section",
    },
    {
      id: "scanner",
      icon: Smartphone,
      label: t("scannerLabel"),
      description: t("scannerDescription"),
      href: "/dashboard/settings?tab=team&connect=1",
      external: true,
    },
    {
      id: "direct",
      icon: UserPlus,
      label: t("directLabel"),
      description: t("directDescription"),
      href: "#direct-issue-section",
    },
  ]

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15">
          <Sparkles className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{t("title")}</h2>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2">
        {items.map((item, i) => {
          const Icon = item.icon
          const content = (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:border-foreground/20 hover:bg-muted/40 transition-colors group h-full">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-medium text-muted-foreground">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-muted-foreground" />
                  <p className="text-[13px] font-medium leading-tight">
                    {item.label}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {item.description}
                </p>
              </div>
              <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
            </div>
          )

          // In-page anchor for items 1, 2, 4; real navigation for item 3.
          // <a> is required for # anchors — Next.js Link doesn't scroll
          // reliably to in-page IDs without a hash fragment escape hatch.
          return (
            <li key={item.id}>
              {item.external ? (
                <Link href={item.href} prefetch={true}>
                  {content}
                </Link>
              ) : (
                <a href={item.href}>{content}</a>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
