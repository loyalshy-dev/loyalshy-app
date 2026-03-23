"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { Plus, Users, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TemplateCardPreview } from "@/components/template-card-preview"
import { statusConfig } from "./program-status"
import { CreateProgramForm } from "./create-program-form"
import { PASS_TYPE_META, type PassType } from "@/types/pass-types"
import { parseCouponConfig, parseMembershipConfig, formatCouponValue, parsePointsConfig } from "@/lib/pass-config"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import type { TemplateListItem } from "@/server/template-actions"
import type { PassType as PlanPassType } from "@/lib/plans"


function getTypeSubtitle(program: TemplateListItem): string {
  const type = program.passType as PassType
  const count = program.passInstanceCount
  const templateCfg = program.config as Record<string, unknown> | null ?? {}
  switch (type) {
    case "STAMP_CARD": {
      const stampsRequired = (templateCfg as { stampsRequired?: number }).stampsRequired ?? 10
      return `${stampsRequired} visits | ${count} enrolled`
    }
    case "COUPON": {
      const config = parseCouponConfig(program.config)
      const rewardDesc = (templateCfg as { rewardDescription?: string }).rewardDescription ?? ""
      const discount = config ? formatCouponValue(config) : rewardDesc
      return `${discount} | ${count} claimed`
    }
    case "MEMBERSHIP": {
      const config = parseMembershipConfig(program.config)
      const tier = config?.membershipTier ?? "Member"
      return `${tier} | ${count} members`
    }
    case "POINTS": {
      const pConfig = parsePointsConfig(program.config)
      const subtitle = pConfig ? `${pConfig.pointsPerVisit} pts/visit` : "Points"
      return `${subtitle} | ${count} enrolled`
    }
    default:
      return `${count} enrolled`
  }
}

type TypeFilter = "ALL" | "STAMP_CARD" | "COUPON" | "MEMBERSHIP" | "POINTS" | "GIFT_CARD" | "TICKET" | "BUSINESS_CARD"

type TemplatesListViewProps = {
  programs: TemplateListItem[]
  organizationId: string
  organizationName: string
  organizationLogo: string | null
  isOwner: boolean
  allowedPassTypes?: PlanPassType[]
}

export function TemplatesListView({
  programs,
  organizationId,
  organizationName,
  organizationLogo,
  isOwner,
  allowedPassTypes,
}: TemplatesListViewProps) {
  const t = useTranslations("dashboard.programs")
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL")

  // Count per type
  const typeCounts: Record<TypeFilter, number> = {
    ALL: programs.length,
    STAMP_CARD: programs.filter((p) => p.passType === "STAMP_CARD").length,
    COUPON: programs.filter((p) => p.passType === "COUPON").length,
    MEMBERSHIP: programs.filter((p) => p.passType === "MEMBERSHIP").length,
    POINTS: programs.filter((p) => p.passType === "POINTS").length,
    GIFT_CARD: programs.filter((p) => p.passType === "GIFT_CARD").length,
    TICKET: programs.filter((p) => p.passType === "TICKET").length,
    BUSINESS_CARD: programs.filter((p) => p.passType === "BUSINESS_CARD").length,
  }

  const filteredPrograms =
    typeFilter === "ALL"
      ? programs
      : programs.filter((p) => p.passType === typeFilter)

  const filterTabs: { key: TypeFilter; label: string }[] = [
    { key: "ALL", label: t("all") },
    { key: "STAMP_CARD", label: t("stampCards") },
    { key: "COUPON", label: t("coupons") },
    { key: "MEMBERSHIP", label: t("memberships") },
    { key: "POINTS", label: t("points") },
    { key: "GIFT_CARD", label: t("giftCards") },
    { key: "TICKET", label: t("tickets") },
    { key: "BUSINESS_CARD", label: t("businessCards") },
  ]

  // Only show filter tabs if there's more than one type
  const hasMultipleTypes = Object.entries(typeCounts)
    .filter(([k]) => k !== "ALL")
    .filter(([, v]) => v > 0).length > 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {t("subtitle")}
          </p>
        </div>
        {isOwner && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setShowCreate(!showCreate)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("createProgram")}
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">{t("newProgram")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("newProgramDescription")}
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
            const count = typeCounts[tab.key]
            if (tab.key !== "ALL" && count === 0) return null
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

      {/* Programs list */}
      {filteredPrograms.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Layers className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold">
            {typeFilter === "ALL" ? t("noPrograms") : `No ${filterTabs.find((tab) => tab.key === typeFilter)?.label.toLowerCase() ?? "programs"} yet`}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {typeFilter === "ALL"
              ? t("createFirst")
              : t("createToStart")}
          </p>
          {isOwner && typeFilter === "ALL" && (
            <Button
              size="sm"
              className="mt-4 gap-1.5"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("createProgram")}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPrograms.map((program) => {
            const cfg = statusConfig[program.status] ?? statusConfig.DRAFT
            const typeMeta = PASS_TYPE_META[program.passType as PassType]
            const TypeIcon = typeMeta?.icon
            return (
              <Card asChild key={program.id}>
              <Link
                href={`/dashboard/programs/${program.id}`}
                className="group overflow-hidden transition-all hover:bg-muted/30 hover:shadow-md"
              >
                {/* Card preview */}
                <div className="flex justify-center bg-muted/40 py-4 px-4 border-b border-border">
                  <TemplateCardPreview
                    template={program}
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
                      {program.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`text-[11px] px-1.5 py-0 shrink-0 ${cfg.className}`}
                    >
                      {cfg.label}
                    </Badge>
                  </div>

                  {/* Type badge */}
                  {typeMeta && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {TypeIcon && <TypeIcon className="h-3 w-3 text-muted-foreground" />}
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {typeMeta.shortLabel}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {getTypeSubtitle(program)}
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
