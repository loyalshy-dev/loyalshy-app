"use client"

import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { PASS_TYPE_META, type PassType } from "@/types/pass-types"
import type { TemplateSummaryItem } from "@/server/analytics"
import { Card } from "@/components/ui/card"

type ProgramsSummaryProps = {
  programs: TemplateSummaryItem[]
}

export function ProgramsSummary({ programs }: ProgramsSummaryProps) {
  const t = useTranslations("dashboard.programsSummary")

  function getMetricLine(program: TemplateSummaryItem): string {
    switch (program.passType) {
      case "STAMP_CARD":
        return `${program.activePassInstances} ${t("enrolled")} \u00b7 ${program.redeemedRewards} ${t("rewardsEarned")}`
      case "COUPON":
        return `${program.availableRewards + program.redeemedRewards} ${t("issued")} \u00b7 ${program.redeemedRewards} ${t("redeemed")}`
      case "MEMBERSHIP":
        return `${program.activePassInstances} ${t("members")} \u00b7 ${program.totalInteractions} ${t("checkIns")}`
      case "POINTS":
        return `${program.activePassInstances} ${t("enrolled")} \u00b7 ${program.redeemedRewards} ${t("redeemed")}`
      case "PREPAID":
        return `${program.activePassInstances} ${t("issued")} \u00b7 ${program.totalInteractions} ${t("uses")}`
      case "GIFT_CARD":
        return `${program.activePassInstances} ${t("cards")} \u00b7 ${program.totalInteractions} ${t("transactions")}`
      case "TICKET":
        return `${program.activePassInstances} ${t("tickets")} \u00b7 ${program.totalInteractions} ${t("scans")}`
      case "ACCESS":
        return `${program.activePassInstances} ${t("passes")} \u00b7 ${program.totalInteractions} ${t("accessLogs")}`
      case "TRANSIT":
        return `${program.activePassInstances} ${t("passes")} \u00b7 ${program.totalInteractions} ${t("trips")}`
      case "BUSINESS_ID":
        return `${program.activePassInstances} ${t("ids")} \u00b7 ${program.totalInteractions} ${t("verifications")}`
      default:
        return `${program.activePassInstances} ${t("enrolled")}`
    }
  }

  if (programs.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
          {t("title")}
        </h3>
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            {t("empty")}
          </p>
          <Link
            href="/dashboard/programs"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand/80 transition-colors"
          >
            <Plus className="size-3.5" />
            {t("createProgram")}
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
        {t("title")}
      </h3>
      <div className="space-y-0">
        {programs.map((program) => {
          const meta = PASS_TYPE_META[program.passType as PassType]
          const Icon = meta.icon

          return (
            <Link
              key={program.id}
              href={`/dashboard/programs/${program.id}`}
              className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 group hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10">
                <Icon className="size-3.5 text-brand" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-snug truncate">
                  {program.name}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {getMetricLine(program)}
                </p>
              </div>
              <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
            </Link>
          )
        })}
      </div>
    </Card>
  )
}
