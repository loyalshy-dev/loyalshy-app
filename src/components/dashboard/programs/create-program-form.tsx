"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createLoyaltyProgram } from "@/server/settings-actions"
import { PROGRAM_TYPE_META, type ProgramType, type PointsCatalogItem } from "@/types/program-types"

// ─── Step 1: Type selector ─────────────────────────────────

function TypeSelector({ onSelect }: { onSelect: (type: ProgramType) => void }) {
  const types: ProgramType[] = ["STAMP_CARD", "COUPON", "MEMBERSHIP", "POINTS", "PREPAID"]

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Choose a program type to get started.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {types.map((type) => {
          const meta = PROGRAM_TYPE_META[type]
          const Icon = meta.icon
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-brand/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10">
                <Icon className="h-4.5 w-4.5 text-brand" />
              </div>
              <div>
                <p className="text-sm font-semibold">{meta.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {meta.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 2: Type-specific form ─────────────────────────────

type StampFormData = {
  name: string
  visitsRequired: number
  rewardDescription: string
  rewardExpiryDays: number
}

type CouponFormData = {
  name: string
  discountType: "percentage" | "fixed" | "freebie"
  discountValue: number
  couponDescription: string
  validUntil: string
  redemptionLimit: "single" | "unlimited"
  terms: string
}

type MembershipFormData = {
  name: string
  membershipTier: string
  benefits: string
  validDuration: "monthly" | "yearly" | "lifetime" | "custom"
  customDurationDays: number
  terms: string
}

function StampCardForm({
  restaurantId,
  onCreated,
  onBack,
}: {
  restaurantId: string
  onCreated: () => void
  onBack: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<StampFormData>({
    defaultValues: {
      name: "",
      visitsRequired: 10,
      rewardDescription: "",
      rewardExpiryDays: 90,
    },
  })

  function onSubmit(data: StampFormData) {
    startTransition(async () => {
      const result = await createLoyaltyProgram({
        restaurantId,
        programType: "STAMP_CARD",
        name: data.name,
        visitsRequired: data.visitsRequired,
        rewardDescription: data.rewardDescription,
        rewardExpiryDays: data.rewardExpiryDays,
        config: {},
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Stamp card program created")
        reset()
        onCreated()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to type selection
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="stamp-name">Program Name</Label>
          <Input
            id="stamp-name"
            {...register("name", { required: "Program name is required" })}
            placeholder="e.g., Coffee Loyalty, Lunch Special"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="stamp-visits">Visits Required</Label>
          <Input
            id="stamp-visits"
            type="number"
            min={3}
            max={30}
            {...register("visitsRequired", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stamp-expiry">Reward Expiry (Days)</Label>
          <Input
            id="stamp-expiry"
            type="number"
            min={0}
            max={365}
            {...register("rewardExpiryDays", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="stamp-reward">Reward Description</Label>
          <Input
            id="stamp-reward"
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
            "Create Stamp Card"
          )}
        </Button>
      </div>
    </form>
  )
}

function CouponForm({
  restaurantId,
  onCreated,
  onBack,
}: {
  restaurantId: string
  onCreated: () => void
  onBack: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<CouponFormData>({
    defaultValues: {
      name: "",
      discountType: "percentage",
      discountValue: 10,
      couponDescription: "",
      validUntil: "",
      redemptionLimit: "single",
      terms: "",
    },
  })

  const discountType = watch("discountType")

  function onSubmit(data: CouponFormData) {
    startTransition(async () => {
      const config = {
        discountType: data.discountType,
        discountValue: data.discountValue,
        couponDescription: data.couponDescription || undefined,
        validUntil: data.validUntil || undefined,
        redemptionLimit: data.redemptionLimit,
        terms: data.terms || undefined,
      }

      // Build a readable reward description from config
      const rewardDesc = data.discountType === "percentage"
        ? `${data.discountValue}% off`
        : data.discountType === "fixed"
          ? `$${data.discountValue} off`
          : "Free item"

      const result = await createLoyaltyProgram({
        restaurantId,
        programType: "COUPON",
        name: data.name,
        visitsRequired: 1,
        rewardDescription: data.couponDescription || rewardDesc,
        rewardExpiryDays: 0,
        config,
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Coupon program created")
        reset()
        onCreated()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to type selection
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="coupon-name">Coupon Name</Label>
          <Input
            id="coupon-name"
            {...register("name", { required: "Coupon name is required" })}
            placeholder="e.g., Summer Special, New Customer Discount"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="coupon-discount-type">Discount Type</Label>
          <select
            id="coupon-discount-type"
            {...register("discountType")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="percentage">Percentage Off</option>
            <option value="fixed">Fixed Amount Off</option>
            <option value="freebie">Free Item</option>
          </select>
        </div>
        {discountType !== "freebie" && (
          <div className="space-y-2">
            <Label htmlFor="coupon-discount-value">
              {discountType === "percentage" ? "Discount (%)" : "Discount ($)"}
            </Label>
            <Input
              id="coupon-discount-value"
              type="number"
              min={1}
              max={discountType === "percentage" ? 100 : 10000}
              {...register("discountValue", { valueAsNumber: true })}
            />
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="coupon-desc">Coupon Description</Label>
          <Input
            id="coupon-desc"
            {...register("couponDescription")}
            placeholder="e.g., Get 20% off your next order"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="coupon-valid-until">Valid Until (Optional)</Label>
          <Input
            id="coupon-valid-until"
            type="date"
            {...register("validUntil")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="coupon-limit">Redemption Limit</Label>
          <select
            id="coupon-limit"
            {...register("redemptionLimit")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="single">Single Use</option>
            <option value="unlimited">Unlimited</option>
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="coupon-terms">Terms & Conditions (Optional)</Label>
          <Textarea
            id="coupon-terms"
            {...register("terms")}
            placeholder="Optional terms..."
            rows={3}
          />
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
            "Create Coupon"
          )}
        </Button>
      </div>
    </form>
  )
}

function MembershipForm({
  restaurantId,
  onCreated,
  onBack,
}: {
  restaurantId: string
  onCreated: () => void
  onBack: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<MembershipFormData>({
    defaultValues: {
      name: "",
      membershipTier: "",
      benefits: "",
      validDuration: "monthly",
      customDurationDays: 30,
      terms: "",
    },
  })

  const validDuration = watch("validDuration")

  function onSubmit(data: MembershipFormData) {
    startTransition(async () => {
      const config = {
        membershipTier: data.membershipTier,
        benefits: data.benefits,
        validDuration: data.validDuration,
        ...(data.validDuration === "custom"
          ? { customDurationDays: data.customDurationDays }
          : {}),
        terms: data.terms || undefined,
      }

      const result = await createLoyaltyProgram({
        restaurantId,
        programType: "MEMBERSHIP",
        name: data.name,
        visitsRequired: 1,
        rewardDescription: `${data.membershipTier} Member`,
        rewardExpiryDays: 0,
        config,
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Membership program created")
        reset()
        onCreated()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to type selection
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="member-name">Program Name</Label>
          <Input
            id="member-name"
            {...register("name", { required: "Program name is required" })}
            placeholder="e.g., VIP Club, Gold Membership"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-tier">Membership Tier</Label>
          <Input
            id="member-tier"
            {...register("membershipTier", {
              required: "Tier name is required",
            })}
            placeholder="e.g., VIP, Gold, Premium"
          />
          {errors.membershipTier && (
            <p className="text-xs text-destructive">
              {errors.membershipTier.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-duration">Duration</Label>
          <select
            id="member-duration"
            {...register("validDuration")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="lifetime">Lifetime</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        {validDuration === "custom" && (
          <div className="space-y-2">
            <Label htmlFor="member-custom-days">Custom Duration (Days)</Label>
            <Input
              id="member-custom-days"
              type="number"
              min={1}
              max={3650}
              {...register("customDurationDays", { valueAsNumber: true })}
            />
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="member-benefits">Benefits</Label>
          <Textarea
            id="member-benefits"
            {...register("benefits", { required: "Benefits are required" })}
            placeholder="List the perks members receive..."
            rows={3}
          />
          {errors.benefits && (
            <p className="text-xs text-destructive">
              {errors.benefits.message}
            </p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="member-terms">Terms & Conditions (Optional)</Label>
          <Textarea
            id="member-terms"
            {...register("terms")}
            placeholder="Optional terms..."
            rows={3}
          />
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
            "Create Membership"
          )}
        </Button>
      </div>
    </form>
  )
}

type PointsFormData = {
  name: string
  pointsPerVisit: number
  rewardExpiryDays: number
}

type CatalogRow = {
  id: string
  name: string
  description: string
  pointsCost: number
}

function PointsForm({
  restaurantId,
  onCreated,
  onBack,
}: {
  restaurantId: string
  onCreated: () => void
  onBack: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [catalog, setCatalog] = useState<CatalogRow[]>([
    { id: crypto.randomUUID(), name: "", description: "", pointsCost: 50 },
  ])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PointsFormData>({
    defaultValues: {
      name: "",
      pointsPerVisit: 10,
      rewardExpiryDays: 90,
    },
  })

  function addCatalogItem() {
    if (catalog.length >= 20) return
    setCatalog((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", description: "", pointsCost: 50 },
    ])
  }

  function removeCatalogItem(id: string) {
    setCatalog((prev) => prev.filter((item) => item.id !== id))
  }

  function updateCatalogItem(id: string, field: keyof Omit<CatalogRow, "id">, value: string | number) {
    setCatalog((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  function onSubmit(data: PointsFormData) {
    // Validate catalog rows have names and valid pointsCost
    const invalidRow = catalog.find(
      (item) => !item.name.trim() || item.pointsCost < 1
    )
    if (invalidRow) {
      toast.error("All catalog items must have a name and a points cost of at least 1")
      return
    }

    startTransition(async () => {
      const catalogItems: PointsCatalogItem[] = catalog.map((item) => ({
        id: crypto.randomUUID(),
        name: item.name.trim(),
        description: item.description.trim() || undefined,
        pointsCost: item.pointsCost,
      }))

      // Auto-compute rewardDescription from cheapest catalog item
      const cheapest = [...catalogItems].sort((a, b) => a.pointsCost - b.pointsCost)[0]
      const rewardDescription = cheapest ? cheapest.name : "Points Reward"

      const config = {
        pointsPerVisit: data.pointsPerVisit,
        catalog: catalogItems,
      }

      const result = await createLoyaltyProgram({
        restaurantId,
        programType: "POINTS",
        name: data.name,
        visitsRequired: 1,
        rewardDescription,
        rewardExpiryDays: data.rewardExpiryDays,
        config,
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Points program created")
        reset()
        setCatalog([{ id: crypto.randomUUID(), name: "", description: "", pointsCost: 50 }])
        onCreated()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to type selection
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="points-name">Program Name</Label>
          <Input
            id="points-name"
            {...register("name", { required: "Program name is required" })}
            placeholder="e.g., Reward Points, Loyalty Points"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="points-per-visit">Points Per Visit</Label>
          <Input
            id="points-per-visit"
            type="number"
            min={1}
            max={100}
            {...register("pointsPerVisit", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="points-expiry">Reward Expiry (Days)</Label>
          <Input
            id="points-expiry"
            type="number"
            min={0}
            max={365}
            {...register("rewardExpiryDays", { valueAsNumber: true })}
          />
        </div>
      </div>

      {/* Reward Catalog */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Reward Catalog</Label>
          <span className="text-xs text-muted-foreground">{catalog.length}/20 items</span>
        </div>
        <div className="space-y-2">
          {catalog.map((item, index) => (
            <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] items-start rounded-md border border-border bg-muted/20 p-3">
              <div className="space-y-1">
                <Label htmlFor={`catalog-name-${item.id}`} className="text-xs text-muted-foreground">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`catalog-name-${item.id}`}
                  value={item.name}
                  onChange={(e) => updateCatalogItem(item.id, "name", e.target.value)}
                  placeholder="e.g., Free Coffee"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`catalog-desc-${item.id}`} className="text-xs text-muted-foreground">
                  Description
                </Label>
                <Input
                  id={`catalog-desc-${item.id}`}
                  value={item.description}
                  onChange={(e) => updateCatalogItem(item.id, "description", e.target.value)}
                  placeholder="Optional"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`catalog-cost-${item.id}`} className="text-xs text-muted-foreground">
                  Points Cost <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`catalog-cost-${item.id}`}
                  type="number"
                  min={1}
                  value={item.pointsCost}
                  onChange={(e) => updateCatalogItem(item.id, "pointsCost", Number(e.target.value))}
                  className="h-8 text-xs w-24"
                />
              </div>
              <div className="flex items-end pb-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCatalogItem(item.id)}
                  disabled={catalog.length === 1}
                  aria-label={`Remove catalog item ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCatalogItem}
          disabled={catalog.length >= 20}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Catalog Item
        </Button>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              Creating...
            </>
          ) : (
            "Create Points Program"
          )}
        </Button>
      </div>
    </form>
  )
}

type PrepaidFormData = {
  name: string
  totalUses: number
  useLabel: string
  rechargeable: boolean
  rechargeAmount: number
  validUntil: string
  terms: string
}

function PrepaidForm({
  restaurantId,
  onCreated,
  onBack,
}: {
  restaurantId: string
  onCreated: () => void
  onBack: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<PrepaidFormData>({
    defaultValues: {
      name: "",
      totalUses: 10,
      useLabel: "use",
      rechargeable: true,
      rechargeAmount: 10,
      validUntil: "",
      terms: "",
    },
  })

  const rechargeable = watch("rechargeable")

  function onSubmit(data: PrepaidFormData) {
    startTransition(async () => {
      const config = {
        totalUses: data.totalUses,
        useLabel: data.useLabel,
        rechargeable: data.rechargeable,
        ...(data.rechargeable ? { rechargeAmount: data.rechargeAmount } : {}),
        ...(data.validUntil ? { validUntil: data.validUntil } : {}),
        ...(data.terms ? { terms: data.terms } : {}),
      }

      const useLabelPlural = data.useLabel + (data.totalUses !== 1 ? "s" : "")

      const result = await createLoyaltyProgram({
        restaurantId,
        programType: "PREPAID",
        name: data.name,
        visitsRequired: data.totalUses,
        rewardDescription: `${data.totalUses} ${useLabelPlural}`,
        rewardExpiryDays: 0,
        config,
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Prepaid pass created")
        reset()
        onCreated()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to type selection
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="prepaid-name">Program Name</Label>
          <Input
            id="prepaid-name"
            {...register("name", { required: "Program name is required" })}
            placeholder="e.g., Bus Pass, Car Wash Card, Class Pack"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="prepaid-total-uses">Total Uses</Label>
          <Input
            id="prepaid-total-uses"
            type="number"
            min={1}
            max={1000}
            {...register("totalUses", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prepaid-use-label">Use Label</Label>
          <Input
            id="prepaid-use-label"
            {...register("useLabel", { required: "Use label is required" })}
            placeholder="e.g., ride, wash, session, class"
          />
          {errors.useLabel && (
            <p className="text-xs text-destructive">{errors.useLabel.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="prepaid-rechargeable">Rechargeable</Label>
          <select
            id="prepaid-rechargeable"
            {...register("rechargeable", { setValueAs: (v) => v === "true" || v === true })}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        {rechargeable && (
          <div className="space-y-2">
            <Label htmlFor="prepaid-recharge-amount">Recharge Amount</Label>
            <Input
              id="prepaid-recharge-amount"
              type="number"
              min={1}
              max={1000}
              {...register("rechargeAmount", { valueAsNumber: true })}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="prepaid-valid-until">Valid Until (Optional)</Label>
          <Input
            id="prepaid-valid-until"
            type="date"
            {...register("validUntil")}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="prepaid-terms">Terms & Conditions (Optional)</Label>
          <Textarea
            id="prepaid-terms"
            {...register("terms")}
            placeholder="Optional terms..."
            rows={3}
          />
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
            "Create Prepaid Pass"
          )}
        </Button>
      </div>
    </form>
  )
}

// ─── Main Component ─────────────────────────────────────────

export function CreateProgramForm({
  restaurantId,
  onCreated,
}: {
  restaurantId: string
  onCreated: () => void
}) {
  const [selectedType, setSelectedType] = useState<ProgramType | null>(null)

  if (!selectedType) {
    return <TypeSelector onSelect={setSelectedType} />
  }

  const formProps = {
    restaurantId,
    onCreated,
    onBack: () => setSelectedType(null),
  }

  switch (selectedType) {
    case "STAMP_CARD":
      return <StampCardForm {...formProps} />
    case "COUPON":
      return <CouponForm {...formProps} />
    case "MEMBERSHIP":
      return <MembershipForm {...formProps} />
    case "POINTS":
      return <PointsForm {...formProps} />
    case "PREPAID":
      return <PrepaidForm {...formProps} />
  }
}
