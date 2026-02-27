"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Users, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { statusConfig } from "./program-status"
import { CreateProgramForm } from "./create-program-form"
import type { ProgramListItem } from "@/server/program-actions"

type ProgramsListViewProps = {
  programs: ProgramListItem[]
  restaurantId: string
  isOwner: boolean
}

export function ProgramsListView({
  programs,
  restaurantId,
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
            return (
              <Link
                key={program.id}
                href={`/dashboard/programs/${program.id}`}
                className="group rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/30"
              >
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

                <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                  <span>{program.visitsRequired} visits</span>
                  <span className="text-border">|</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {program.enrollmentCount} enrolled
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
