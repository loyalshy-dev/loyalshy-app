"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertTriangle,
  Archive,
  Paintbrush,
  Loader2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  updateLoyaltyProgram,
  archiveLoyaltyProgram,
} from "@/server/settings-actions"
import type { ProgramWithDesign } from "@/server/settings-actions"

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

export function ProgramEditor({
  program,
  restaurant,
}: {
  program: ProgramWithDesign
  restaurant: Restaurant
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isArchiving, startArchiveTransition] = useTransition()
  const [showWarning, setShowWarning] = useState(false)
  const [resetProgress, setResetProgress] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
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
          {/* Card Design link */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            asChild
          >
            <Link href={`/dashboard/programs/${program.id}/design`}>
              <Paintbrush className="h-3.5 w-3.5" />
              Card Design
            </Link>
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
