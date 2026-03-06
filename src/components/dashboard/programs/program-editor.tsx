"use client"

import { useState, useTransition, useEffect, useRef, useCallback } from "react"
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
  updatePassTemplate,
  archivePassTemplate,
  activateTemplate as activateProgram,
  reactivateTemplate as reactivateProgram,
  deleteTemplate as deleteProgram,
} from "@/server/org-settings-actions"
import type { TemplateWithDesign, TemplateDeleteCounts } from "@/server/org-settings-actions"
import { parseCouponConfig, parseMembershipConfig, parseMinigameConfig, parsePointsConfig, parsePrepaidConfig } from "@/lib/pass-config"
import type { PointsCatalogItem } from "@/types/pass-types"
import { PASS_TYPE_META, type PassType } from "@/types/pass-types"
import { PrizeRevealEditor } from "@/components/dashboard/programs/prize-reveal-editor"

// ─── Section Nav (scroll-spy) ────────────────────────────────────────

function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "")
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current?.disconnect()

    const ratios = new Map<string, number>()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.intersectionRatio)
        }
        // Pick the section with the highest visible ratio
        let best = ""
        let bestRatio = -1
        for (const { id } of sections) {
          const r = ratios.get(id) ?? 0
          if (r > bestRatio) {
            bestRatio = r
            best = id
          }
        }
        if (best) setActiveId(best)
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-80px 0px -40% 0px" }
    )

    for (const { id } of sections) {
      const el = document.getElementById(id)
      if (el) observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [sections])

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  return (
    <nav className="space-y-1" aria-label="Page sections">
      {sections.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => scrollTo(id)}
          className={`block w-full text-left text-[13px] px-2.5 py-1.5 rounded-md transition-colors ${
            activeId === id
              ? "text-foreground font-medium bg-accent/50"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}

// ─── Types ───────────────────────────────────────────────────────────

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
  couponCode: string
  validUntil: string
  redemptionLimit: string
  // Membership config fields
  membershipTier: string
  benefits: string
  validDuration: string
  customDurationDays: number
  // Prepaid config fields
  totalUses: number
  useLabel: string
  rechargeable: boolean
  rechargeAmount: number
  prepaidValidUntil: string
  prepaidTerms: string
}

type Organization = {
  id: string
  name: string
  slug: string
  logo: string | null
  brandColor: string | null
  secondaryColor: string | null
}

// ─── Program Editor ──────────────────────────────────────────────────

export function ProgramEditor({
  program,
  organization,
}: {
  program: TemplateWithDesign
  organization: Organization
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
  const [deleteCounts, setDeleteCounts] = useState<TemplateDeleteCounts | null>(null)

  const programType = (program.passType ?? "STAMP_CARD") as PassType
  const isStampCard = programType === "STAMP_CARD"
  const isCoupon = programType === "COUPON"
  const isMembership = programType === "MEMBERSHIP"
  const isPoints = programType === "POINTS"
  const isPrepaid = programType === "PREPAID"

  // Extract stamp-card flat fields from config JSON
  const stampConfig = program.config as Record<string, unknown> | null ?? {}
  const programVisitsRequired = (stampConfig.stampsRequired as number) ?? (stampConfig.visitsRequired as number) ?? 10
  const programRewardDescription = (stampConfig.rewardDescription as string) ?? ""
  const programRewardExpiryDays = (stampConfig.rewardExpiryDays as number) ?? 90

  const couponConfig = isCoupon ? parseCouponConfig(program.config) : null
  const minigameConfig = (isStampCard || isCoupon) ? parseMinigameConfig(program.config) : null
  const hasPrizes = !!(minigameConfig?.enabled && minigameConfig.prizes?.length)
  const membershipConfig = isMembership ? parseMembershipConfig(program.config) : null
  const pointsConfig = isPoints ? parsePointsConfig(program.config) : null
  const prepaidConfig = isPrepaid ? parsePrepaidConfig(program.config) : null
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
    reset,
  } = useForm<LoyaltyForm>({
    defaultValues: {
      name: program.name,
      visitsRequired: programVisitsRequired,
      rewardDescription: programRewardDescription,
      rewardExpiryDays: programRewardExpiryDays,
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
      couponCode: couponConfig?.couponCode ?? "",
      validUntil: couponConfig?.validUntil ?? "",
      redemptionLimit: couponConfig?.redemptionLimit ?? "single",
      // Membership defaults
      membershipTier: membershipConfig?.membershipTier ?? "",
      benefits: membershipConfig?.benefits ?? "",
      validDuration: membershipConfig?.validDuration ?? "monthly",
      customDurationDays: membershipConfig?.customDurationDays ?? 30,
      // Prepaid defaults
      totalUses: prepaidConfig?.totalUses ?? 10,
      useLabel: prepaidConfig?.useLabel ?? "use",
      rechargeable: prepaidConfig?.rechargeable ?? false,
      rechargeAmount: prepaidConfig?.rechargeAmount ?? 10,
      prepaidValidUntil: prepaidConfig?.validUntil ?? "",
      prepaidTerms: prepaidConfig?.terms ?? "",
    },
  })

  const visitsRequired = watch("visitsRequired")
  const visitsChanged =
    Number(visitsRequired) !== programVisitsRequired
  const validDuration = watch("validDuration")
  const discountType = watch("discountType")
  function buildConfig(data: LoyaltyForm): Record<string, unknown> | undefined {
    if (isCoupon) {
      return {
        discountType: data.discountType,
        discountValue: data.discountType === "freebie" ? 0 : data.discountValue,
        couponDescription: data.rewardDescription || undefined,
        couponCode: data.couponCode || undefined,
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
    if (isPrepaid) {
      return {
        totalUses: data.totalUses,
        useLabel: data.useLabel,
        rechargeable: data.rechargeable,
        ...(data.rechargeable ? { rechargeAmount: data.rechargeAmount } : {}),
        ...(data.prepaidValidUntil ? { validUntil: data.prepaidValidUntil } : {}),
        ...(data.prepaidTerms ? { terms: data.prepaidTerms } : {}),
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
      const typeConfig = buildConfig(data)
      const baseConfig = isStampCard ? {
        stampsRequired: data.visitsRequired,
        rewardDescription: data.rewardDescription,
        rewardExpiryDays: data.rewardExpiryDays,
      } : {}
      const mergedConfig = typeConfig
        ? { ...baseConfig, ...typeConfig }
        : Object.keys(baseConfig).length > 0 ? baseConfig : undefined
      const result = await updatePassTemplate({
        organizationId: organization.id,
        templateId: program.id,
        name: data.name,
        termsAndConditions: data.termsAndConditions,
        status: data.status,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        resetProgress,
        ...(mergedConfig ? { config: mergedConfig } : {}),
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Program updated")
        reset(data)
        setShowWarning(false)
        setResetProgress(false)
      }
    })
  }

  function handleArchive() {
    startDangerTransition(async () => {
      const result = await archivePassTemplate(organization.id, program.id)
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
      const result = await activateProgram(organization.id, program.id)
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
      const result = await reactivateProgram(organization.id, program.id)
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
      const result = await deleteProgram(organization.id, program.id, deleteConfirmName)
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
  const typeMeta = PASS_TYPE_META[programType]

  // Build sections list based on program type
  const navSections: { id: string; label: string }[] = [
    { id: "details", label: "Details" },
    ...(isStampCard ? [{ id: "stamps", label: "Stamps" }] : []),
    ...(isCoupon ? [{ id: "coupon", label: "Coupon" }] : []),
    ...(isMembership ? [{ id: "membership", label: "Membership" }] : []),
    ...(isPoints ? [{ id: "points", label: "Points" }] : []),
    { id: "schedule", label: "Schedule" },
    { id: "terms", label: "Terms" },
    ...((isStampCard || isCoupon) ? [{ id: "prize-reveal", label: "Prize Reveal" }] : []),
    { id: "danger", label: "Danger" },
  ]

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex gap-8">
        {/* Left column — sections */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Program Type badge */}
          {typeMeta && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <typeMeta.icon className="h-3.5 w-3.5" />
              <span className="font-medium">{typeMeta.label}</span>
            </div>
          )}

          {/* ─── Section 1: Program Details ─────────────────────── */}
          <section id="details" className="scroll-mt-24 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Program Details</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Basic information about your program.</p>
            </div>
            <div className="space-y-2">
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
          </section>

          {/* ─── Section 2: Type-specific Config ────────────────── */}

          {/* Stamp Config */}
          {isStampCard && (
            <section id="stamps" className="scroll-mt-24 space-y-4 border-t border-border pt-6">
              <div>
                <h3 className="text-sm font-semibold">Stamp Configuration</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure visits required and reward details.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
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
                    disabled={isArchived || hasPrizes}
                  />
                  {hasPrizes ? (
                    <p className="text-xs text-muted-foreground">
                      Auto-generated from prize reveal prizes. Edit prizes below to update.
                    </p>
                  ) : errors.rewardDescription ? (
                    <p className="text-xs text-destructive">
                      {errors.rewardDescription.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          )}

          {/* Coupon Config */}
          {isCoupon && (
            <section id="coupon" className="scroll-mt-24 space-y-4 border-t border-border pt-6">
              <div>
                <h3 className="text-sm font-semibold">Coupon Configuration</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Set the discount type, value, and usage limits.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
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
                {discountType !== "freebie" && (
                  <div className="space-y-2">
                    <Label htmlFor={`discount-value-${program.id}`}>
                      {discountType === "percentage" ? "Discount (%)" : "Discount Amount"}
                    </Label>
                    <Input
                      id={`discount-value-${program.id}`}
                      type="number"
                      min={1}
                      max={discountType === "percentage" ? 100 : 10000}
                      {...register("discountValue", { valueAsNumber: true })}
                      disabled={isArchived}
                    />
                  </div>
                )}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`reward-${program.id}`}>Description</Label>
                  <Input
                    id={`reward-${program.id}`}
                    {...register("rewardDescription", {
                      required: "Description is required",
                    })}
                    placeholder="e.g., Get 20% off your next order"
                    disabled={isArchived || hasPrizes}
                  />
                  {hasPrizes ? (
                    <p className="text-xs text-muted-foreground">
                      Auto-generated from prize reveal prizes. Edit prizes below to update.
                    </p>
                  ) : errors.rewardDescription ? (
                    <p className="text-xs text-destructive">
                      {errors.rewardDescription.message}
                    </p>
                  ) : null}
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
                  <Label htmlFor={`coupon-code-${program.id}`}>Coupon Code</Label>
                  <Input
                    id={`coupon-code-${program.id}`}
                    {...register("couponCode")}
                    placeholder="e.g., SAVE20"
                    disabled={isArchived}
                  />
                  <p className="text-xs text-muted-foreground">Optional. Shown on the wallet pass and card page.</p>
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
              </div>
            </section>
          )}

          {/* Membership Config */}
          {isMembership && (
            <section id="membership" className="scroll-mt-24 space-y-4 border-t border-border pt-6">
              <div>
                <h3 className="text-sm font-semibold">Membership Configuration</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Define membership tiers, duration, and benefits.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            </section>
          )}

          {/* Points Config */}
          {isPoints && (
            <section id="points" className="scroll-mt-24 space-y-4 border-t border-border pt-6">
              <div>
                <h3 className="text-sm font-semibold">Points Configuration</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Set how points are earned and what they can be redeemed for.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            </section>
          )}

          {isPrepaid && (
            <section id="prepaid" className="scroll-mt-24 space-y-4 border-t border-border pt-6">
              <div>
                <h3 className="text-sm font-semibold">Prepaid Configuration</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configure the number of uses and recharge options.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`total-uses-${program.id}`}>Total Uses</Label>
                  <Input
                    id={`total-uses-${program.id}`}
                    type="number"
                    min={1}
                    max={999}
                    {...register("totalUses", { valueAsNumber: true, min: 1 })}
                    disabled={isArchived}
                  />
                  <p className="text-xs text-muted-foreground">Number of uses included in this pass.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`use-label-${program.id}`}>Use Label</Label>
                  <Input
                    id={`use-label-${program.id}`}
                    {...register("useLabel")}
                    placeholder="e.g., ride, wash, session"
                    disabled={isArchived}
                  />
                  <p className="text-xs text-muted-foreground">What each use is called (e.g., &quot;ride&quot;, &quot;wash&quot;).</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`rechargeable-${program.id}`}>Rechargeable</Label>
                  <select
                    id={`rechargeable-${program.id}`}
                    {...register("rechargeable")}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isArchived}
                  >
                    <option value="false">No — single use pass</option>
                    <option value="true">Yes — can be recharged</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`prepaid-valid-${program.id}`}>Valid Until (Optional)</Label>
                  <Input
                    id={`prepaid-valid-${program.id}`}
                    type="date"
                    {...register("prepaidValidUntil")}
                    disabled={isArchived}
                  />
                </div>
              </div>
            </section>
          )}

          {/* ─── Section 3: Schedule ────────────────────────────── */}
          <section id="schedule" className="scroll-mt-24 space-y-4 border-t border-border pt-6">
            <div>
              <h3 className="text-sm font-semibold">Schedule</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Control when the program is active and accepting customers.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
                  Only active programs accept new {isStampCard ? "visits" : "customers"}.
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
          </section>

          {/* ─── Section 4: Terms & Conditions ──────────────────── */}
          <section id="terms" className="scroll-mt-24 space-y-4 border-t border-border pt-6">
            <div>
              <h3 className="text-sm font-semibold">Terms & Conditions</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Optional terms displayed on the wallet pass.</p>
            </div>
            <div className="space-y-2">
              <Textarea
                id={`terms-${program.id}`}
                {...register("termsAndConditions")}
                placeholder="Optional terms shown on the wallet pass..."
                rows={4}
                disabled={isArchived}
              />
            </div>
          </section>

          {/* ─── Section 5: Prize Reveal (stamp card & coupon) ──── */}
          {(isStampCard || isCoupon) && (
            <section id="prize-reveal" className="scroll-mt-24 border-t border-border pt-6">
              <PrizeRevealEditor
                program={{
                  id: program.id,
                  name: program.name,
                  passType: program.passType,
                  config: program.config,
                  rewardDescription: programRewardDescription,
                  status: program.status,
                  organizationId: organization.id,
                }}
              />
            </section>
          )}

          {/* Visits Changed Warning (stamp only) */}
          {isStampCard && showWarning && visitsChanged && (
            <div className="rounded-lg border border-warning/50 bg-warning/5 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">
                      Changing visits required from {programVisitsRequired} to{" "}
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

          {/* ─── Actions Row ────────────────────────────────────── */}
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

            {(isDirty || showWarning) && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-warning font-medium">
                  Unsaved changes
                </p>
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
                  disabled={isPending || isArchived}
                  size="sm"
                >
                  {isPending
                    ? "Saving..."
                    : showWarning
                      ? "Confirm & Save"
                      : "Save changes"}
                </Button>
              </div>
            )}
          </div>

          {/* ─── Section 6: Danger Zone ─────────────────────────── */}
          <section id="danger" className="scroll-mt-24 space-y-4 border-t border-destructive/30 pt-6">
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
          </section>
        </div>

        {/* Right column — sticky section nav */}
        <div className="hidden lg:block w-44 shrink-0">
          <div className="sticky top-24">
            <SectionNav sections={navSections} />
          </div>
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
                <li>{deleteCounts.passInstances} pass instance{deleteCounts.passInstances !== 1 ? "s" : ""}</li>
                <li>{deleteCounts.interactions} interaction{deleteCounts.interactions !== 1 ? "s" : ""}</li>
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
