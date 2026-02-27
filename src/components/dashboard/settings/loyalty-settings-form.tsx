"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertTriangle,
  ChevronDown,
  Plus,
  Archive,
  Paintbrush,
  Users,
  Loader2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CardDesignEditor } from "./card-design-editor"
import {
  updateLoyaltyProgram,
  createLoyaltyProgram,
  archiveLoyaltyProgram,
} from "@/server/settings-actions"
import type { ProgramWithDesign } from "@/server/settings-actions"

// ─── Types ──────────────────────────────────────────────────

type LoyaltyForm = {
  name: string
  visitsRequired: number
  rewardDescription: string
  rewardExpiryDays: number
  termsAndConditions: string
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  startsAt: string
  endsAt: string
}

type Restaurant = {
  id: string
  name: string
  slug: string
  logo: string | null
  brandColor: string | null
  secondaryColor: string | null
}

// ─── Status badge config ────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-success/10 text-success border-success/20",
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-warning/10 text-warning border-warning/20",
  },
}

// ─── Create Program Dialog ──────────────────────────────────

function CreateProgramForm({
  restaurantId,
  onCreated,
}: {
  restaurantId: string
  onCreated: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      name: "",
      visitsRequired: 10,
      rewardDescription: "",
      rewardExpiryDays: 90,
    },
  })

  function onSubmit(data: {
    name: string
    visitsRequired: number
    rewardDescription: string
    rewardExpiryDays: number
  }) {
    startTransition(async () => {
      const result = await createLoyaltyProgram({
        restaurantId,
        name: data.name,
        visitsRequired: data.visitsRequired,
        rewardDescription: data.rewardDescription,
        rewardExpiryDays: data.rewardExpiryDays,
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Program created")
        reset()
        onCreated()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="create-name">Program Name</Label>
          <Input
            id="create-name"
            {...register("name", { required: "Program name is required" })}
            placeholder="e.g., Coffee Loyalty, Lunch Special"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-visits">Visits Required</Label>
          <Input
            id="create-visits"
            type="number"
            min={3}
            max={30}
            {...register("visitsRequired", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-expiry">Reward Expiry (Days)</Label>
          <Input
            id="create-expiry"
            type="number"
            min={0}
            max={365}
            {...register("rewardExpiryDays", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="create-reward">Reward Description</Label>
          <Input
            id="create-reward"
            {...register("rewardDescription", {
              required: "Reward description is required",
            })}
            placeholder="e.g., Free coffee or dessert"
          />
          {errors.rewardDescription && (
            <p className="text-xs text-destructive">
              {errors.rewardDescription.message}
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              Creating...
            </>
          ) : (
            "Create Program"
          )}
        </Button>
      </div>
    </form>
  )
}

// ─── Single Program Editor ──────────────────────────────────

function ProgramEditor({
  program,
  restaurant,
  walletPassCount,
}: {
  program: ProgramWithDesign
  restaurant: Restaurant
  walletPassCount: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isArchiving, startArchiveTransition] = useTransition()
  const [showWarning, setShowWarning] = useState(false)
  const [resetProgress, setResetProgress] = useState(false)
  const [showCardDesign, setShowCardDesign] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
  } = useForm<LoyaltyForm>({
    defaultValues: {
      name: program.name,
      visitsRequired: program.visitsRequired,
      rewardDescription: program.rewardDescription,
      rewardExpiryDays: program.rewardExpiryDays,
      termsAndConditions: program.termsAndConditions ?? "",
      status: program.status as "DRAFT" | "ACTIVE" | "ARCHIVED",
      startsAt: new Date(program.startsAt).toISOString().slice(0, 10),
      endsAt: program.endsAt
        ? new Date(program.endsAt).toISOString().slice(0, 10)
        : "",
    },
  })

  const visitsRequired = watch("visitsRequired")
  const status = watch("status")
  const visitsChanged =
    Number(visitsRequired) !== program.visitsRequired

  function onSubmit(data: LoyaltyForm) {
    if (visitsChanged && !showWarning) {
      setShowWarning(true)
      return
    }

    startTransition(async () => {
      const result = await updateLoyaltyProgram({
        restaurantId: restaurant.id,
        programId: program.id,
        name: data.name,
        visitsRequired: data.visitsRequired,
        rewardDescription: data.rewardDescription,
        rewardExpiryDays: data.rewardExpiryDays,
        termsAndConditions: data.termsAndConditions,
        status: data.status,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        resetProgress,
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Program updated")
        setShowWarning(false)
        setResetProgress(false)
      }
    })
  }

  function handleArchive() {
    if (
      !confirm(
        "Archive this program? Active enrollments will be frozen and customers will not be able to earn new visits."
      )
    ) {
      return
    }

    startArchiveTransition(async () => {
      const result = await archiveLoyaltyProgram(restaurant.id, program.id)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Program archived")
        router.refresh()
      }
    })
  }

  const isArchived = program.status === "ARCHIVED"

  // Card design editor for this program
  if (showCardDesign) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Card Design: {program.name}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCardDesign(false)}
          >
            Back to program settings
          </Button>
        </div>
        <CardDesignEditor
          restaurant={restaurant}
          programId={program.id}
          cardDesign={program.cardDesign}
          walletPassCount={walletPassCount}
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Program Details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`name-${program.id}`}>Program Name</Label>
          <Input
            id={`name-${program.id}`}
            {...register("name", { required: "Program name is required" })}
            disabled={isArchived}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`visits-${program.id}`}>Visits Required</Label>
          <Input
            id={`visits-${program.id}`}
            type="number"
            min={3}
            max={30}
            {...register("visitsRequired", { valueAsNumber: true })}
            disabled={isArchived}
          />
          <p className="text-xs text-muted-foreground">
            Number of visits before a customer earns a reward (3-30).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`expiry-${program.id}`}>
            Reward Expiry (Days)
          </Label>
          <Input
            id={`expiry-${program.id}`}
            type="number"
            min={0}
            max={365}
            {...register("rewardExpiryDays", { valueAsNumber: true })}
            disabled={isArchived}
          />
          <p className="text-xs text-muted-foreground">
            Set to 0 for rewards that never expire.
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`reward-${program.id}`}>Reward Description</Label>
          <Input
            id={`reward-${program.id}`}
            {...register("rewardDescription", {
              required: "Reward description is required",
            })}
            placeholder="e.g., Free coffee or dessert"
            disabled={isArchived}
          />
          {errors.rewardDescription && (
            <p className="text-xs text-destructive">
              {errors.rewardDescription.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`status-${program.id}`}>Status</Label>
          <select
            id={`status-${program.id}`}
            {...register("status")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isArchived}
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Only active programs accept new visits.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`starts-${program.id}`}>Start Date</Label>
          <Input
            id={`starts-${program.id}`}
            type="date"
            {...register("startsAt")}
            disabled={isArchived}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`ends-${program.id}`}>End Date (Optional)</Label>
          <Input
            id={`ends-${program.id}`}
            type="date"
            {...register("endsAt")}
            disabled={isArchived}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty for an open-ended program.
          </p>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="space-y-2">
        <Label htmlFor={`terms-${program.id}`}>Terms & Conditions</Label>
        <Textarea
          id={`terms-${program.id}`}
          {...register("termsAndConditions")}
          placeholder="Optional terms shown on the wallet pass..."
          rows={4}
          disabled={isArchived}
        />
      </div>

      {/* Visits Changed Warning */}
      {showWarning && visitsChanged && (
        <div className="rounded-lg border border-warning/50 bg-warning/5 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">
                  Changing visits required from {program.visitsRequired} to{" "}
                  {visitsRequired}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This will affect customers currently in a cycle. Choose how
                  to handle existing progress:
                </p>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`progressOption-${program.id}`}
                    checked={!resetProgress}
                    onChange={() => setResetProgress(false)}
                    className="accent-foreground"
                  />
                  <span className="text-sm">
                    Keep existing progress -- customers retain their current
                    visit count
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`progressOption-${program.id}`}
                    checked={resetProgress}
                    onChange={() => setResetProgress(true)}
                    className="accent-foreground"
                  />
                  <span className="text-sm">
                    Reset all progress -- all customers start fresh at 0 visits
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions Row */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-2">
          {/* Card Design button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowCardDesign(true)}
          >
            <Paintbrush className="h-3.5 w-3.5" />
            Card Design
          </Button>

          {/* Archive button (only for non-archived programs) */}
          {!isArchived && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-warning hover:text-warning"
              onClick={handleArchive}
              disabled={isArchiving}
            >
              {isArchiving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              Archive
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <p className="text-xs text-warning font-medium">
              Unsaved changes
            </p>
          )}
          {showWarning && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowWarning(false)}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={isPending || isArchived || (!isDirty && !showWarning)}
            size="sm"
          >
            {isPending
              ? "Saving..."
              : showWarning
                ? "Confirm & Save"
                : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  )
}

// ─── Main Component ─────────────────────────────────────────

export function LoyaltySettingsForm({
  restaurant,
  programs,
  walletPassCount,
}: {
  restaurant: Restaurant
  programs: ProgramWithDesign[]
  walletPassCount: number
}) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(
    // Auto-expand the first active program, or the first program
    programs.find((p) => p.status === "ACTIVE")?.id ??
      programs[0]?.id ??
      null
  )

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-5">
      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Loyalty Programs</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your loyalty programs. Each program has its own stamp card,
            rewards, and card design.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="h-3.5 w-3.5" />
          Create Program
        </Button>
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
              restaurantId={restaurant.id}
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
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No loyalty programs yet. Create your first program to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {programs.map((program) => {
            const isExpanded = expandedId === program.id
            const cfg = statusConfig[program.status] ?? statusConfig.DRAFT

            return (
              <div
                key={program.id}
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                {/* Collapsed header */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(program.id)}
                  className="flex items-center justify-between w-full px-6 py-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">
                          {program.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[11px] px-1.5 py-0 shrink-0 ${cfg.className}`}
                        >
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>
                          {program.visitsRequired} visits for reward
                        </span>
                        <span className="text-border">|</span>
                        <span>{program.rewardDescription}</span>
                        <span className="text-border">|</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {program.enrollmentCount} enrolled
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border px-6 py-5">
                    <ProgramEditor
                      program={program}
                      restaurant={restaurant}
                      walletPassCount={walletPassCount}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
