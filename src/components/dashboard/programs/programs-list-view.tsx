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
import { PROGRAM_TYPE_META, type ProgramType } from "@/types/program-types"
import { parseCouponConfig, parseMembershipConfig, formatCouponValue } from "@/lib/program-config"
import { cn } from "@/lib/utils"
import type { ProgramListItem } from "@/server/program-actions"

function buildDesign(cardDesign: ProgramListItem["cardDesign"]): WalletPassDesign {
  const sf = cardDesign ? parseStripFilters(cardDesign.editorConfig) : null
  const useStampGrid = sf ? (sf.useStampGrid || cardDesign?.patternStyle === "STAMP_GRID") : false

  return {
    cardType: (cardDesign?.cardType ?? "STAMP") as WalletPassDesign["cardType"],
    shape: (cardDesign?.shape ?? "CLEAN") as WalletPassDesign["shape"],
    primaryColor: cardDesign?.primaryColor ?? "#1a1a2e",
    secondaryColor: cardDesign?.secondaryColor ?? "#ffffff",
    textColor: cardDesign?.textColor ?? "#ffffff",
    progressStyle: (cardDesign?.progressStyle ?? "NUMBERS") as WalletPassDesign["progressStyle"],
    labelFormat: (cardDesign?.labelFormat ?? "UPPERCASE") as WalletPassDesign["labelFormat"],
    customProgressLabel: cardDesign?.customProgressLabel ?? null,
    stripImageUrl: cardDesign?.stripImageUrl ?? null,
    stripOpacity: sf?.stripOpacity ?? 1,
    stripGrayscale: sf?.stripGrayscale ?? false,
    patternStyle: (cardDesign?.patternStyle === "STAMP_GRID" ? "NONE" : cardDesign?.patternStyle ?? "NONE") as WalletPassDesign["patternStyle"],
    useStampGrid,
    stripColor1: sf?.stripColor1 ?? null,
    stripColor2: sf?.stripColor2 ?? null,
    stripFill: sf?.stripFill ?? "gradient",
    patternColor: sf?.patternColor ?? null,
    stripImagePosition: sf?.stripImagePosition,
    stripImageZoom: sf?.stripImageZoom,
    stampGridConfig: useStampGrid && cardDesign
      ? parseStampGridConfig(cardDesign.editorConfig)
      : undefined,
  }
}

function getTypeSubtitle(program: ProgramListItem): string {
  const type = program.programType as ProgramType
  switch (type) {
    case "STAMP_CARD":
      return `${program.visitsRequired} visits | ${program.enrollmentCount} enrolled`
    case "COUPON": {
      const config = parseCouponConfig(program.config)
      const discount = config ? formatCouponValue(config) : program.rewardDescription
      return `${discount} | ${program.enrollmentCount} claimed`
    }
    case "MEMBERSHIP": {
      const config = parseMembershipConfig(program.config)
      const tier = config?.membershipTier ?? "Member"
      return `${tier} | ${program.enrollmentCount} members`
    }
    default:
      return `${program.enrollmentCount} enrolled`
  }
}

function ProgramCardPreview({
  design,
  program,
  restaurantName,
}: {
  design: WalletPassDesign
  program: ProgramListItem
  restaurantName: string
}) {
  const type = program.programType as ProgramType
  const couponConfig = type === "COUPON" ? parseCouponConfig(program.config) : null
  const membershipConfig = type === "MEMBERSHIP" ? parseMembershipConfig(program.config) : null

  return (
    <WalletPassRenderer
      design={design}
      format="apple"
      restaurantName={restaurantName}
      programName={program.name}
      currentVisits={4}
      totalVisits={program.visitsRequired}
      rewardDescription={program.rewardDescription}
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
    />
  )
}

type TypeFilter = "ALL" | ProgramType

type ProgramsListViewProps = {
  programs: ProgramListItem[]
  restaurantId: string
  restaurantName: string
  isOwner: boolean
}

export function ProgramsListView({
  programs,
  restaurantId,
  restaurantName,
  isOwner,
}: ProgramsListViewProps) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL")

  // Count per type
  const typeCounts: Record<TypeFilter, number> = {
    ALL: programs.length,
    STAMP_CARD: programs.filter((p) => p.programType === "STAMP_CARD").length,
    COUPON: programs.filter((p) => p.programType === "COUPON").length,
    MEMBERSHIP: programs.filter((p) => p.programType === "MEMBERSHIP").length,
  }

  const filteredPrograms =
    typeFilter === "ALL"
      ? programs
      : programs.filter((p) => p.programType === typeFilter)

  const filterTabs: { key: TypeFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "STAMP_CARD", label: "Stamp Cards" },
    { key: "COUPON", label: "Coupons" },
    { key: "MEMBERSHIP", label: "Memberships" },
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
              restaurantId={restaurantId}
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
            const design = buildDesign(program.cardDesign)
            const typeMeta = PROGRAM_TYPE_META[program.programType as ProgramType]
            const TypeIcon = typeMeta?.icon
            return (
              <Link
                key={program.id}
                href={`/dashboard/programs/${program.id}`}
                className="group rounded-lg border border-border bg-card overflow-hidden transition-colors hover:bg-muted/30"
              >
                {/* Card preview */}
                <div className="flex justify-center bg-muted/40 py-4 px-4 border-b border-border">
                  <ProgramCardPreview
                    design={design}
                    program={program}
                    restaurantName={restaurantName}
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
