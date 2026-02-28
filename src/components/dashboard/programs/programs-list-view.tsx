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
import type { ProgramListItem } from "@/server/program-actions"

function buildDesign(cardDesign: ProgramListItem["cardDesign"]): WalletPassDesign {
  const sf = cardDesign ? parseStripFilters(cardDesign.editorConfig) : null
  const useStampGrid = sf ? (sf.useStampGrid || cardDesign?.patternStyle === "STAMP_GRID") : false

  return {
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
            <h2 className="text-sm font-semibold">New Loyalty Program</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create a new program. It starts as a draft -- activate it when
              ready.
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

      {/* Programs list */}
      {programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Layers className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold">No programs yet</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create your first loyalty program to start rewarding your customers.
          </p>
          {isOwner && (
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
          {programs.map((program) => {
            const cfg = statusConfig[program.status] ?? statusConfig.DRAFT
            const design = buildDesign(program.cardDesign)
            return (
              <Link
                key={program.id}
                href={`/dashboard/programs/${program.id}`}
                className="group rounded-lg border border-border bg-card overflow-hidden transition-colors hover:bg-muted/30"
              >
                {/* Card preview */}
                <div className="flex justify-center bg-muted/40 py-4 px-4 border-b border-border">
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

                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
                    {program.rewardDescription}
                  </p>

                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span>{program.visitsRequired} visits</span>
                    <span className="text-border">|</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {program.enrollmentCount} enrolled
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
