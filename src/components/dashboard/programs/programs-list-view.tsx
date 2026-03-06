"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Users, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { WalletPassRenderer, type WalletPassDesign } from "@/components/wallet-pass-renderer"
import { parseStampGridConfig, parseStripFilters } from "@/lib/wallet/card-design"
import { statusConfig } from "./program-status"
import { CreateProgramForm } from "./create-program-form"
import { PASS_TYPE_META, type PassType } from "@/types/pass-types"
import { parseCouponConfig, parseMembershipConfig, formatCouponValue, parsePointsConfig, formatPointsValue, parsePrepaidConfig } from "@/lib/pass-config"
import { cn } from "@/lib/utils"
import type { TemplateListItem } from "@/server/template-actions"

function buildDesign(passDesign: TemplateListItem["passDesign"]): WalletPassDesign {
  const sf = passDesign ? parseStripFilters(passDesign.editorConfig) : null
  const useStampGrid = sf ? (sf.useStampGrid || passDesign?.patternStyle === "STAMP_GRID") : false

  return {
    cardType: (passDesign?.cardType ?? "STAMP") as WalletPassDesign["cardType"],
    showStrip: passDesign?.showStrip ?? true,
    primaryColor: passDesign?.primaryColor ?? "#1a1a2e",
    secondaryColor: passDesign?.secondaryColor ?? "#ffffff",
    textColor: passDesign?.textColor ?? "#ffffff",
    progressStyle: (passDesign?.progressStyle ?? "NUMBERS") as WalletPassDesign["progressStyle"],
    labelFormat: (passDesign?.labelFormat ?? "UPPERCASE") as WalletPassDesign["labelFormat"],
    customProgressLabel: passDesign?.customProgressLabel ?? null,
    stripImageUrl: passDesign?.stripImageUrl ?? null,
    stripOpacity: sf?.stripOpacity ?? 1,
    stripGrayscale: sf?.stripGrayscale ?? false,
    patternStyle: (passDesign?.patternStyle === "STAMP_GRID" ? "NONE" : passDesign?.patternStyle ?? "NONE") as WalletPassDesign["patternStyle"],
    useStampGrid,
    stripColor1: sf?.stripColor1 ?? null,
    stripColor2: sf?.stripColor2 ?? null,
    stripFill: sf?.stripFill ?? "gradient",
    patternColor: sf?.patternColor ?? null,
    stripImagePosition: sf?.stripImagePosition,
    stripImageZoom: sf?.stripImageZoom,
    stampGridConfig: useStampGrid && passDesign
      ? parseStampGridConfig(passDesign.editorConfig)
      : undefined,
  }
}

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
    case "PREPAID": {
      const prepConfig = parsePrepaidConfig(program.config)
      return `${prepConfig?.totalUses ?? 0} ${prepConfig?.useLabel ?? "use"}s | ${count} issued`
    }
    default:
      return `${count} enrolled`
  }
}

function TemplateCardPreview({
  design,
  program,
  organizationName,
}: {
  design: WalletPassDesign
  program: TemplateListItem
  organizationName: string
}) {
  const type = program.passType as PassType
  const couponConfig = type === "COUPON" ? parseCouponConfig(program.config) : null
  const membershipConfig = type === "MEMBERSHIP" ? parseMembershipConfig(program.config) : null
  const prepaidConfig = type === "PREPAID" ? parsePrepaidConfig(program.config) : null
  const templateCfg = program.config as Record<string, unknown> | null ?? {}
  const stampsRequired = (templateCfg as { stampsRequired?: number }).stampsRequired ?? 10
  const rewardDescription = (templateCfg as { rewardDescription?: string }).rewardDescription ?? ""

  return (
    <WalletPassRenderer
      design={design}
      format="apple"
      programName={program.name}
      currentVisits={4}
      totalVisits={stampsRequired}
      rewardDescription={rewardDescription}
      compact
      width={180}
      height={250}
      // Coupon props
      discountText={couponConfig ? formatCouponValue(couponConfig) : undefined}
      couponCode={couponConfig?.couponCode}
      validUntil={couponConfig?.validUntil
        ? new Date(couponConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : type === "COUPON" ? "No expiry" : undefined}
      // Membership props
      tierName={membershipConfig?.membershipTier}
      benefits={membershipConfig?.benefits}
      // Prepaid props
      remainingUses={prepaidConfig?.totalUses}
      totalUses={prepaidConfig?.totalUses}
      prepaidValidUntil={prepaidConfig?.validUntil
        ? new Date(prepaidConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : type === "PREPAID" ? "No expiry" : undefined}
    />
  )
}

type TypeFilter = "ALL" | "STAMP_CARD" | "COUPON" | "MEMBERSHIP" | "POINTS" | "PREPAID"

type TemplatesListViewProps = {
  programs: TemplateListItem[]
  organizationId: string
  organizationName: string
  isOwner: boolean
}

export function TemplatesListView({
  programs,
  organizationId,
  organizationName,
  isOwner,
}: TemplatesListViewProps) {
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
    PREPAID: programs.filter((p) => p.passType === "PREPAID").length,
  }

  const filteredPrograms =
    typeFilter === "ALL"
      ? programs
      : programs.filter((p) => p.passType === typeFilter)

  const filterTabs: { key: TypeFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "STAMP_CARD", label: "Stamp Cards" },
    { key: "COUPON", label: "Coupons" },
    { key: "MEMBERSHIP", label: "Memberships" },
    { key: "POINTS", label: "Points" },
    { key: "PREPAID", label: "Prepaid" },
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
          <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Manage your loyalty programs, rewards, and card designs.
          </p>
        </div>
        {isOwner && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setShowCreate(!showCreate)}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Program
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">New Program</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a program type and configure it. It starts as a draft -- activate it when ready.
            </p>
          </div>
          <div className="p-6">
            <CreateProgramForm
              organizationId={organizationId}
              onCreated={() => {
                setShowCreate(false)
                router.refresh()
              }}
            />
          </div>
        </div>
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Layers className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold">
            {typeFilter === "ALL" ? "No programs yet" : `No ${filterTabs.find((t) => t.key === typeFilter)?.label.toLowerCase() ?? "programs"} yet`}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {typeFilter === "ALL"
              ? "Create your first loyalty program to start rewarding your customers."
              : "Create a new program to get started."}
          </p>
          {isOwner && typeFilter === "ALL" && (
            <Button
              size="sm"
              className="mt-4 gap-1.5"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Program
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPrograms.map((program) => {
            const cfg = statusConfig[program.status] ?? statusConfig.DRAFT
            const design = buildDesign(program.passDesign)
            const typeMeta = PASS_TYPE_META[program.passType as PassType]
            const TypeIcon = typeMeta?.icon
            return (
              <Link
                key={program.id}
                href={`/dashboard/programs/${program.id}`}
                className="group rounded-lg border border-border bg-card overflow-hidden transition-colors hover:bg-muted/30"
              >
                {/* Card preview */}
                <div className="flex justify-center bg-muted/40 py-4 px-4 border-b border-border">
                  <TemplateCardPreview
                    design={design}
                    program={program}
                    organizationName={organizationName ?? ""}
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
            )
          })}
        </div>
      )}
    </div>
  )
}
