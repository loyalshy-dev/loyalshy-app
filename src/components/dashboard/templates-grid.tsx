"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Plus, Layers, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TemplateCardPreview } from "@/components/template-card-preview"
import { statusConfig } from "./programs/program-status"
import { CreateProgramForm } from "./programs/create-program-form"
import { PASS_TYPE_META, type PassType } from "@/types/pass-types"
import {
  parseCouponConfig,
  parseMembershipConfig,
  formatCouponValue,
  parsePointsConfig,
} from "@/lib/pass-config"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import type { TemplateListItem } from "@/server/template-actions"
import type { PassType as PlanPassType } from "@/lib/plans"


function getTypeSubtitle(template: TemplateListItem): string {
  const type = template.passType as PassType
  const count = template.passInstanceCount
  const cfg = (template.config as Record<string, unknown>) ?? {}

  switch (type) {
    case "STAMP_CARD": {
      const stampsRequired =
        (cfg as { stampsRequired?: number }).stampsRequired ?? 10
      return `${stampsRequired} stamps | ${count} active`
    }
    case "COUPON": {
      const config = parseCouponConfig(template.config)
      const discount = config ? formatCouponValue(config) : ""
      return `${discount} | ${count} claimed`
    }
    case "MEMBERSHIP": {
      const config = parseMembershipConfig(template.config)
      const tier = config?.membershipTier ?? "Member"
      return `${tier} | ${count} members`
    }
    case "POINTS": {
      const pConfig = parsePointsConfig(template.config)
      const subtitle = pConfig ? `${pConfig.pointsPerVisit} pts/visit` : "Points"
      return `${subtitle} | ${count} active`
    }
    default:
      return `${count} passes`
  }
}

type TypeFilter =
  | "ALL"
  | "STAMP_CARD"
  | "COUPON"
  | "MEMBERSHIP"
  | "POINTS"
  | "GIFT_CARD"
  | "TICKET"

type TemplatesGridViewProps = {
  templates: TemplateListItem[]
  organizationId: string
  organizationName: string
  organizationLogo: string | null
  isOwner: boolean
  allowedPassTypes?: PlanPassType[]
}

export function TemplatesGridView({
  templates,
  organizationId,
  organizationName,
  organizationLogo,
  isOwner,
  allowedPassTypes,
}: TemplatesGridViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showCreate, setShowCreate] = useState(
    searchParams.get("action") === "create"
  )
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL")

  // Count per type (only types that exist)
  const typeCounts = new Map<string, number>()
  typeCounts.set("ALL", templates.length)
  for (const t of templates) {
    typeCounts.set(t.passType, (typeCounts.get(t.passType) ?? 0) + 1)
  }

  const filteredTemplates =
    typeFilter === "ALL"
      ? templates
      : templates.filter((t) => t.passType === typeFilter)

  // Build filter tabs from actual data
  const filterTabs: { key: TypeFilter; label: string }[] = [
    { key: "ALL", label: "All" },
  ]
  const typeOrder: TypeFilter[] = [
    "STAMP_CARD",
    "COUPON",
    "MEMBERSHIP",
    "POINTS",
    "GIFT_CARD",
    "TICKET",
  ]
  for (const t of typeOrder) {
    if (typeCounts.has(t)) {
      const meta = PASS_TYPE_META[t as PassType]
      filterTabs.push({ key: t, label: meta?.shortLabel ?? t })
    }
  }

  const hasMultipleTypes =
    filterTabs.filter((t) => t.key !== "ALL").length > 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your Programs
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Manage your programs, pass designs, and distribution.
          </p>
        </div>
        {isOwner && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setShowCreate(!showCreate)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Program
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">New Program</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a pass type and configure it. It starts as a draft —
              activate it when ready.
            </p>
          </div>
          <div className="p-6">
            <CreateProgramForm
              organizationId={organizationId}
              allowedPassTypes={allowedPassTypes}
              onCreated={() => {
                setShowCreate(false)
                router.refresh()
              }}
            />
          </div>
        </Card>
      )}

      {/* Type filter tabs */}
      {hasMultipleTypes && (
        <div className="flex gap-1 overflow-x-auto">
          {filterTabs.map((tab) => {
            const count = typeCounts.get(tab.key) ?? 0
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTypeFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                  typeFilter === tab.key
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                <span className="ml-1.5 text-[11px] opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Templates grid */}
      {filteredTemplates.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Layers className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold">
            {typeFilter === "ALL"
              ? "No programs yet"
              : `No ${filterTabs.find((t) => t.key === typeFilter)?.label.toLowerCase() ?? "programs"} yet`}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create your first program to start issuing digital wallet
            passes.
          </p>
          {isOwner && typeFilter === "ALL" && (
            <Button
              size="sm"
              className="mt-4 gap-1.5"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New Program
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => {
            const cfg =
              statusConfig[template.status] ?? statusConfig.DRAFT
            const typeMeta = PASS_TYPE_META[template.passType as PassType]
            const TypeIcon = typeMeta?.icon
            return (
              <Card asChild key={template.id}>
              <Link
                href={`/dashboard/programs/${template.id}`}
                className="group overflow-hidden transition-all hover:bg-muted/30 hover:shadow-md"
              >
                {/* Card preview */}
                <div className="flex justify-center bg-muted/40 py-4 px-4 border-b border-border">
                  <TemplateCardPreview
                    template={template}
                    logoUrl={organizationLogo}
                    compact
                    width={180}
                    height={250}
                  />
                </div>

                {/* Card info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold truncate group-hover:text-foreground">
                      {template.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`text-[11px] px-1.5 py-0 shrink-0 ${cfg.className}`}
                    >
                      {cfg.label}
                    </Badge>
                  </div>

                  {typeMeta && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {TypeIcon && (
                        <TypeIcon className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {typeMeta.shortLabel}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {getTypeSubtitle(template)}
                    </span>
                  </div>
                </div>
              </Link>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
