"use client"

import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"
import { PROGRAM_TYPE_META } from "@/types/program-types"
import type { ProgramSummaryItem } from "@/server/analytics"

type ProgramsSummaryProps = {
  programs: ProgramSummaryItem[]
}

function getMetricLine(program: ProgramSummaryItem): string {
  switch (program.programType) {
    case "STAMP_CARD":
      return `${program.activeEnrollments} enrolled \u00b7 ${program.redeemedRewards} rewards earned`
    case "COUPON":
      return `${program.availableRewards + program.redeemedRewards} issued \u00b7 ${program.redeemedRewards} redeemed`
    case "MEMBERSHIP":
      return `${program.activeEnrollments} members \u00b7 ${program.totalVisits} check-ins`
    case "POINTS":
      return `${program.activeEnrollments} enrolled \u00b7 ${program.redeemedRewards} redeemed`
  }
}

export function ProgramsSummary({ programs }: ProgramsSummaryProps) {
  if (programs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
          Programs
        </h3>
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No active programs yet.
          </p>
          <Link
            href="/dashboard/programs"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand/80 transition-colors"
          >
            <Plus className="size-3.5" />
            Create a program
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
        Programs
      </h3>
      <div className="space-y-0">
        {programs.map((program) => {
          const meta = PROGRAM_TYPE_META[program.programType]
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
    </div>
  )
}
