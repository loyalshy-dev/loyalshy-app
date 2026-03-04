"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Loader2,
  Paintbrush,
  Play,
  Trash2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  updateLoyaltyProgram,
  archiveLoyaltyProgram,
  activateProgram,
  reactivateProgram,
  deleteProgram,
} from "@/server/settings-actions"
import type { ProgramWithDesign, ProgramDeleteCounts } from "@/server/settings-actions"
import { parseCouponConfig, parseMembershipConfig, parsePointsConfig } from "@/lib/program-config"
import type { PointsCatalogItem } from "@/types/program-types"
import { PROGRAM_TYPE_META, type ProgramType } from "@/types/program-types"

type LoyaltyForm = {
  name: string
  visitsRequired: number
  rewardDescription: string
  rewardExpiryDays: number
  termsAndConditions: string
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  startsAt: string
  endsAt: string
  // Coupon config fields
  discountType: string
  discountValue: number
  couponDescription: string
  validUntil: string
  redemptionLimit: string
  // Membership config fields
  membershipTier: string
  benefits: string
  validDuration: string
  customDurationDays: number
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
  const [isDangerPending, startDangerTransition] = useTransition()
  const [showWarning, setShowWarning] = useState(false)
  const [resetProgress, setResetProgress] = useState(false)

  // Danger zone dialog state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [showReactivateDialog, setShowReactivateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleteCounts, setDeleteCounts] = useState<ProgramDeleteCounts | null>(null)

  const programType = (program.programType ?? "STAMP_CARD") as ProgramType
  const isStampCard = programType === "STAMP_CARD"
  const isCoupon = programType === "COUPON"
  const isMembership = programType === "MEMBERSHIP"
  const isPoints = programType === "POINTS"

  const couponConfig = isCoupon ? parseCouponConfig(program.config) : null
  const membershipConfig = isMembership ? parseMembershipConfig(program.config) : null
  const pointsConfig = isPoints ? parsePointsConfig(program.config) : null
  const [pointsPerVisit, setPointsPerVisit] = useState<number>(
    pointsConfig?.pointsPerVisit ?? 10
  )
  const [catalogItems, setCatalogItems] = useState<PointsCatalogItem[]>(
    pointsConfig?.catalog ?? []
  )

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
      // Coupon defaults
      discountType: couponConfig?.discountType ?? "percentage",
      discountValue: couponConfig?.discountValue ?? 10,
      couponDescription: couponConfig?.couponDescription ?? "",
      validUntil: couponConfig?.validUntil ?? "",
      redemptionLimit: couponConfig?.redemptionLimit ?? "single",
      // Membership defaults
      membershipTier: membershipConfig?.membershipTier ?? "",
      benefits: membershipConfig?.benefits ?? "",
      validDuration: membershipConfig?.validDuration ?? "monthly",
      customDurationDays: membershipConfig?.customDurationDays ?? 30,
    },
  })

  const visitsRequired = watch("visitsRequired")
  const visitsChanged =
    Number(visitsRequired) !== program.visitsRequired
  const validDuration = watch("validDuration")
  function buildConfig(data: LoyaltyForm): Record<string, unknown> | undefined {
    if (isCoupon) {
      return {
        discountType: data.discountType,
        discountValue: data.discountValue,
        couponDescription: data.couponDescription || undefined,
        validUntil: data.validUntil || undefined,
        redemptionLimit: data.redemptionLimit,
        terms: data.termsAndConditions || undefined,
      }
    }
    if (isMembership) {
      return {
        membershipTier: data.membershipTier,
        benefits: data.benefits,
        validDuration: data.validDuration,
        ...(data.validDuration === "custom"
          ? { customDurationDays: data.customDurationDays }
          : {}),
        terms: data.termsAndConditions || undefined,
      }
    }
    if (isPoints) {
      return {
        pointsPerVisit,
        catalog: catalogItems,
      }
    }
    return undefined
  }

  function onSubmit(data: LoyaltyForm) {
    if (isStampCard && visitsChanged && !showWarning) {
      setShowWarning(true)
      return
    }

    startTransition(async () => {
      const config = buildConfig(data)
      const result = await updateLoyaltyProgram({
        restaurantId: restaurant.id,
        programId: program.id,
        name: data.name,
        visitsRequired: isStampCard ? data.visitsRequired : 1,
        rewardDescription: data.rewardDescription,
        rewardExpiryDays: data.rewardExpiryDays,
        termsAndConditions: data.termsAndConditions,
        status: data.status,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        resetProgress,
        ...(config ? { config } : {}),
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
    startDangerTransition(async () => {
      const result = await archiveLoyaltyProgram(restaurant.id, program.id)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Program archived")
        setShowArchiveDialog(false)
        router.refresh()
      }
    })
  }

  function handleActivate() {
    startDangerTransition(async () => {
      const result = await activateProgram(restaurant.id, program.id)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Program activated")
        router.refresh()
      }
    })
  }

  function handleReactivate() {
    startDangerTransition(async () => {
      const result = await reactivateProgram(restaurant.id, program.id)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Program reactivated")
        setShowReactivateDialog(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    startDangerTransition(async () => {
      const result = await deleteProgram(restaurant.id, program.id, deleteConfirmName)
      if ("error" in result) {
        if (result.counts) {
          setDeleteCounts(result.counts)
        }
        toast.error(String(result.error))
      } else {
        toast.success("Program deleted")
        setShowDeleteDialog(false)
        router.push("/dashboard/programs")
      }
    })
  }

  const isArchived = program.status === "ARCHIVED"
  const isDraft = program.status === "DRAFT"
  const typeMeta = PROGRAM_TYPE_META[programType]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Program Type badge */}
      {typeMeta && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <typeMeta.icon className="h-3.5 w-3.5" />
          <span className="font-medium">{typeMeta.label}</span>
        </div>
      )}

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

        {/* Stamp-only fields */}
        {isStampCard && (
          <>
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
          </>
        )}

        {/* Coupon-specific fields */}
        {isCoupon && (
          <>
            <div className="space-y-2">
              <Label htmlFor={`discount-type-${program.id}`}>Discount Type</Label>
              <select
                id={`discount-type-${program.id}`}
                {...register("discountType")}
                disabled={isArchived}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="percentage">Percentage Off</option>
                <option value="fixed">Fixed Amount Off</option>
                <option value="freebie">Free Item</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`discount-value-${program.id}`}>Discount Value</Label>
              <Input
                id={`discount-value-${program.id}`}
                type="number"
                min={0}
                max={10000}
                {...register("discountValue", { valueAsNumber: true })}
                disabled={isArchived}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`coupon-desc-${program.id}`}>Coupon Description</Label>
              <Input
                id={`coupon-desc-${program.id}`}
                {...register("couponDescription")}
                placeholder="e.g., Get 20% off your next order"
                disabled={isArchived}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`valid-until-${program.id}`}>Valid Until</Label>
              <Input
                id={`valid-until-${program.id}`}
                type="date"
                {...register("validUntil")}
                disabled={isArchived}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`redemption-limit-${program.id}`}>Redemption Limit</Label>
              <select
                id={`redemption-limit-${program.id}`}
                {...register("redemptionLimit")}
                disabled={isArchived}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="single">Single Use</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`reward-${program.id}`}>Reward Description</Label>
              <Input
                id={`reward-${program.id}`}
                {...register("rewardDescription", {
                  required: "Reward description is required",
                })}
                placeholder="e.g., 20% off"
                disabled={isArchived}
              />
            </div>
          </>
        )}

        {/* Membership-specific fields */}
        {isMembership && (
          <>
            <div className="space-y-2">
              <Label htmlFor={`tier-${program.id}`}>Membership Tier</Label>
              <Input
                id={`tier-${program.id}`}
                {...register("membershipTier", { required: "Tier name is required" })}
                placeholder="e.g., VIP, Gold, Premium"
                disabled={isArchived}
              />
              {errors.membershipTier && (
                <p className="text-xs text-destructive">{errors.membershipTier.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`duration-${program.id}`}>Duration</Label>
              <select
                id={`duration-${program.id}`}
                {...register("validDuration")}
                disabled={isArchived}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="lifetime">Lifetime</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {validDuration === "custom" && (
              <div className="space-y-2">
                <Label htmlFor={`custom-days-${program.id}`}>Custom Duration (Days)</Label>
                <Input
                  id={`custom-days-${program.id}`}
                  type="number"
                  min={1}
                  max={3650}
                  {...register("customDurationDays", { valueAsNumber: true })}
                  disabled={isArchived}
                />
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`benefits-${program.id}`}>Benefits</Label>
              <Textarea
                id={`benefits-${program.id}`}
                {...register("benefits", { required: "Benefits are required" })}
                placeholder="List the perks members receive..."
                rows={3}
                disabled={isArchived}
              />
              {errors.benefits && (
                <p className="text-xs text-destructive">{errors.benefits.message}</p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`reward-${program.id}`}>Reward Description</Label>
              <Input
                id={`reward-${program.id}`}
                {...register("rewardDescription", {
                  required: "Reward description is required",
                })}
                placeholder="e.g., VIP Member"
                disabled={isArchived}
              />
            </div>
          </>
        )}

        {/* Points-specific fields */}
        {isPoints && (
          <>
            <div className="space-y-2">
              <Label htmlFor={`points-per-visit-${program.id}`}>Points Per Visit</Label>
              <Input
                id={`points-per-visit-${program.id}`}
                type="number"
                min={1}
                max={100}
                value={pointsPerVisit}
                onChange={(e) => setPointsPerVisit(Number(e.target.value))}
                disabled={isArchived}
              />
              <p className="text-xs text-muted-foreground">
                Points awarded to customers each time they visit (1–100).
              </p>
            </div>

            <div className="sm:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Reward Catalog</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Items customers can redeem with their points (up to 20).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isArchived || catalogItems.length >= 20}
                  onClick={() =>
                    setCatalogItems((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        description: "",
                        pointsCost: 100,
                      },
                    ])
                  }
                >
                  Add Item
                </Button>
              </div>

              {catalogItems.length === 0 && (
                <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md px-3 py-4 text-center">
                  No catalog items yet. Add at least one reward for customers to redeem.
                </p>
              )}

              <div className="space-y-2">
                {catalogItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-border p-3 space-y-2"
                  >
                    {/* Row 1: Name + Points Cost */}
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                      <div className="space-y-1">
                        <Label
                          htmlFor={`catalog-name-${item.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Reward Name
                        </Label>
                        <Input
                          id={`catalog-name-${item.id}`}
                          value={item.name}
                          placeholder="e.g., Free Coffee"
                          disabled={isArchived}
                          onChange={(e) =>
                            setCatalogItems((prev) =>
                              prev.map((ci, i) =>
                                i === index ? { ...ci, name: e.target.value } : ci
                              )
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1 w-28 shrink-0">
                        <Label
                          htmlFor={`catalog-cost-${item.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Points Cost
                        </Label>
                        <Input
                          id={`catalog-cost-${item.id}`}
                          type="number"
                          min={1}
                          max={100000}
                          value={item.pointsCost}
                          disabled={isArchived}
                          onChange={(e) =>
                            setCatalogItems((prev) =>
                              prev.map((ci, i) =>
                                i === index
                                  ? { ...ci, pointsCost: Number(e.target.value) }
                                  : ci
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                    {/* Row 2: Description + Remove */}
                    <div className="flex gap-2 items-end">
                      <div className="space-y-1 flex-1">
                        <Label
                          htmlFor={`catalog-desc-${item.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Description (optional)
                        </Label>
                        <Input
                          id={`catalog-desc-${item.id}`}
                          value={item.description ?? ""}
                          placeholder="Short description..."
                          disabled={isArchived}
                          onChange={(e) =>
                            setCatalogItems((prev) =>
                              prev.map((ci, i) =>
                                i === index
                                  ? { ...ci, description: e.target.value }
                                  : ci
                              )
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={isArchived}
                        aria-label="Remove catalog item"
                        onClick={() =>
                          setCatalogItems((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`reward-${program.id}`}>Reward Description</Label>
              <Input
                id={`reward-${program.id}`}
                {...register("rewardDescription", {
                  required: "Reward description is required",
                })}
                placeholder="e.g., Redeem points for free items"
                disabled={isArchived}
              />
              {errors.rewardDescription && (
                <p className="text-xs text-destructive">
                  {errors.rewardDescription.message}
                </p>
              )}
            </div>
          </>
        )}

        {/* Shared fields */}
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

      {/* Visits Changed Warning (stamp only) */}
      {isStampCard && showWarning && visitsChanged && (
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

      {/* ─── Danger Zone ─────────────────────────────────────── */}
      <div className="rounded-lg border border-destructive/30 p-4 space-y-4 mt-2">
        <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>

        {/* Activate (DRAFT only) */}
        {isDraft && (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Activate program</p>
              <p className="text-xs text-muted-foreground">
                Make this program live so customers can start earning visits.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={handleActivate}
              disabled={isDangerPending}
            >
              {isDangerPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Activate
            </Button>
          </div>
        )}

        {/* Archive (ACTIVE only) */}
        {program.status === "ACTIVE" && (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Archive program</p>
              <p className="text-xs text-muted-foreground">
                Active enrollments will be frozen and customers won&apos;t earn new visits.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-warning hover:text-warning"
              onClick={() => setShowArchiveDialog(true)}
              disabled={isDangerPending}
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </Button>
          </div>
        )}

        {/* Reactivate (ARCHIVED only) */}
        {isArchived && (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Reactivate program</p>
              <p className="text-xs text-muted-foreground">
                Set the program back to active and unfreeze all frozen enrollments.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => setShowReactivateDialog(true)}
              disabled={isDangerPending}
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              Reactivate
            </Button>
          </div>
        )}

        {/* Delete (all statuses) */}
        <div className="flex items-center justify-between gap-4 border-t border-destructive/20 pt-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Delete program</p>
            <p className="text-xs text-muted-foreground">
              Permanently delete this program, including all enrollments, visits, and rewards. This cannot be undone.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => {
              setDeleteConfirmName("")
              setDeleteCounts(null)
              setShowDeleteDialog(true)
            }}
            disabled={isDangerPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Archive AlertDialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive program</AlertDialogTitle>
            <AlertDialogDescription>
              Active enrollments will be frozen and customers won&apos;t earn new visits.
              Earned rewards will remain valid. You can reactivate the program later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDangerPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={handleArchive}
              disabled={isDangerPending}
            >
              {isDangerPending ? "Archiving..." : "Archive program"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate AlertDialog */}
      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate program</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the program back to active and unfreeze all frozen enrollments.
              Customers will be able to earn visits again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDangerPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={handleReactivate}
              disabled={isDangerPending}
            >
              {isDangerPending ? "Reactivating..." : "Reactivate program"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog (with name confirmation) */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete program</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All data associated with
              this program will be deleted.
            </DialogDescription>
          </DialogHeader>

          {deleteCounts && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm space-y-1">
              <p className="font-medium text-destructive">The following data will be deleted:</p>
              <ul className="list-disc list-inside text-muted-foreground text-xs space-y-0.5">
                <li>{deleteCounts.enrollments} enrollment{deleteCounts.enrollments !== 1 ? "s" : ""}</li>
                <li>{deleteCounts.visits} visit{deleteCounts.visits !== 1 ? "s" : ""}</li>
                <li>{deleteCounts.rewards} reward{deleteCounts.rewards !== 1 ? "s" : ""}</li>
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              Type <span className="font-semibold">{program.name}</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={program.name}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isDangerPending}>Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmName !== program.name || isDangerPending}
            >
              {isDangerPending ? "Deleting..." : "Delete program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
