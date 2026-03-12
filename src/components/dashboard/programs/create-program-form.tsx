"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { createPassTemplate } from "@/server/org-settings-actions"
import { PASS_TYPE_META, type PassType, type PointsCatalogItem } from "@/types/pass-types"

// ─── Step 1: Type selector ─────────────────────────────────

function TypeSelector({ onSelect }: { onSelect: (type: PassType) => void }) {
  const types: PassType[] = [
    "STAMP_CARD", "COUPON", "MEMBERSHIP", "POINTS", "PREPAID",
    "GIFT_CARD", "TICKET", "ACCESS", "TRANSIT", "BUSINESS_ID",
  ]

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Choose a program type to get started.
      </p>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {types.map((type) => {
          const meta = PASS_TYPE_META[type]
          const Icon = meta.icon
          return (
            <Card asChild key={type}>
            <button
              type="button"
              onClick={() => onSelect(type)}
              className="flex flex-col items-start gap-2 p-4 text-left transition-all hover:bg-muted/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            </Card>
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
  organizationId,
  onCreated,
  onBack,
}: {
  organizationId: string
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
      const result = await createPassTemplate({
        organizationId,
        passType: "STAMP_CARD",
        name: data.name,
        config: {
          stampsRequired: data.visitsRequired,
          rewardDescription: data.rewardDescription,
          rewardExpiryDays: data.rewardExpiryDays,
        },
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
  organizationId,
  onCreated,
  onBack,
}: {
  organizationId: string
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

      const result = await createPassTemplate({
        organizationId,
        passType: "COUPON",
        name: data.name,
        config: {
          ...config,
          rewardDescription: data.couponDescription || rewardDesc,
        },
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
  organizationId,
  onCreated,
  onBack,
}: {
  organizationId: string
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

      const result = await createPassTemplate({
        organizationId,
        passType: "MEMBERSHIP",
        name: data.name,
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
  organizationId,
  onCreated,
  onBack,
}: {
  organizationId: string
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

      const result = await createPassTemplate({
        organizationId,
        passType: "POINTS",
        name: data.name,
        config: {
          ...config,
          rewardDescription,
          rewardExpiryDays: data.rewardExpiryDays,
        },
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
  organizationId,
  onCreated,
  onBack,
}: {
  organizationId: string
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

      const result = await createPassTemplate({
        organizationId,
        passType: "PREPAID",
        name: data.name,
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

// ─── Gift Card Form ──────────────────────────────────────────

type GiftCardFormData = {
  name: string
  currency: string
  initialBalance: number
  partialRedemption: boolean
  expiryMonths: number
}

function GiftCardForm({
  organizationId,
  onCreated,
  onBack,
}: {
  organizationId: string
  onCreated: () => void
  onBack: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<GiftCardFormData>({
    defaultValues: {
      name: "",
      currency: "USD",
      initialBalance: 50,
      partialRedemption: true,
      expiryMonths: 0,
    },
  })

  function onSubmit(data: GiftCardFormData) {
    startTransition(async () => {
      const result = await createPassTemplate({
        organizationId,
        passType: "GIFT_CARD",
        name: data.name,
        config: {
          currency: data.currency,
          initialBalanceCents: Math.round(data.initialBalance * 100),
          partialRedemption: data.partialRedemption,
          ...(data.expiryMonths > 0 ? { expiryMonths: data.expiryMonths } : {}),
        },
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Gift card created")
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
          <Label htmlFor="gift-name">Card Name</Label>
          <Input
            id="gift-name"
            {...register("name", { required: "Card name is required" })}
            placeholder="e.g., Store Gift Card, Birthday Gift"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="gift-currency">Currency</Label>
          <select
            id="gift-currency"
            {...register("currency")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (&euro;)</option>
            <option value="GBP">GBP (&pound;)</option>
            <option value="CAD">CAD ($)</option>
            <option value="AUD">AUD ($)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gift-balance">Initial Balance</Label>
          <Input
            id="gift-balance"
            type="number"
            min={1}
            max={10000}
            step={0.01}
            {...register("initialBalance", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gift-partial">Partial Redemption</Label>
          <select
            id="gift-partial"
            {...register("partialRedemption", { setValueAs: (v) => v === "true" || v === true })}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="true">Yes</option>
            <option value="false">No (full balance only)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gift-expiry">Expiry (Months, 0 = never)</Label>
          <Input
            id="gift-expiry"
            type="number"
            min={0}
            max={120}
            {...register("expiryMonths", { valueAsNumber: true })}
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
            "Create Gift Card"
          )}
        </Button>
      </div>
    </form>
  )
}

// ─── Ticket Form ─────────────────────────────────────────────

type TicketFormData = {
  name: string
  eventName: string
  eventDate: string
  eventVenue: string
  maxScans: number
}

function TicketForm({
  organizationId,
  onCreated,
  onBack,
}: {
  organizationId: string
  onCreated: () => void
  onBack: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TicketFormData>({
    defaultValues: {
      name: "",
      eventName: "",
      eventDate: "",
      eventVenue: "",
      maxScans: 1,
    },
  })

  function onSubmit(data: TicketFormData) {
    startTransition(async () => {
      const result = await createPassTemplate({
        organizationId,
        passType: "TICKET",
        name: data.name,
        config: {
          eventName: data.eventName,
          eventDate: data.eventDate,
          eventVenue: data.eventVenue,
          barcodeType: "qr" as const,
          maxScans: data.maxScans,
        },
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Event ticket created")
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
          <Label htmlFor="ticket-name">Program Name</Label>
          <Input
            id="ticket-name"
            {...register("name", { required: "Program name is required" })}
            placeholder="e.g., Summer Concert 2026, Conference VIP"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ticket-event-name">Event Name</Label>
          <Input
            id="ticket-event-name"
            {...register("eventName", { required: "Event name is required" })}
            placeholder="e.g., Summer Music Festival"
          />
          {errors.eventName && (
            <p className="text-xs text-destructive">{errors.eventName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ticket-event-date">Event Date</Label>
          <Input
            id="ticket-event-date"
            type="date"
            {...register("eventDate", { required: "Event date is required" })}
          />
          {errors.eventDate && (
            <p className="text-xs text-destructive">{errors.eventDate.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ticket-max-scans">Max Scans</Label>
          <Input
            id="ticket-max-scans"
            type="number"
            min={1}
            max={100}
            {...register("maxScans", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ticket-venue">Venue</Label>
          <Input
            id="ticket-venue"
            {...register("eventVenue", { required: "Venue is required" })}
            placeholder="e.g., Madison Square Garden"
          />
          {errors.eventVenue && (
            <p className="text-xs text-destructive">{errors.eventVenue.message}</p>
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
            "Create Ticket"
          )}
        </Button>
      </div>
    </form>
  )
}

// ─── Access Form ─────────────────────────────────────────────

type AccessFormData = {
  name: string
  accessLabel: string
  validDuration: "monthly" | "yearly" | "lifetime" | "custom"
  customDurationDays: number
  maxDailyUses: number
  validTimeStart: string
  validTimeEnd: string
}

function AccessForm({
  organizationId,
  onCreated,
  onBack,
}: {
  organizationId: string
  onCreated: () => void
  onBack: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [validDays, setValidDays] = useState<string[]>([])
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<AccessFormData>({
    defaultValues: {
      name: "",
      accessLabel: "Access",
      validDuration: "monthly",
      customDurationDays: 30,
      maxDailyUses: 0,
      validTimeStart: "",
      validTimeEnd: "",
    },
  })

  const validDuration = watch("validDuration")
  const dayOptions = [
    { value: "mon", label: "Mon" },
    { value: "tue", label: "Tue" },
    { value: "wed", label: "Wed" },
    { value: "thu", label: "Thu" },
    { value: "fri", label: "Fri" },
    { value: "sat", label: "Sat" },
    { value: "sun", label: "Sun" },
  ]

  function toggleDay(day: string) {
    setValidDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function onSubmit(data: AccessFormData) {
    startTransition(async () => {
      const result = await createPassTemplate({
        organizationId,
        passType: "ACCESS",
        name: data.name,
        config: {
          accessLabel: data.accessLabel,
          validDuration: data.validDuration,
          ...(data.validDuration === "custom" ? { customDurationDays: data.customDurationDays } : {}),
          ...(data.maxDailyUses > 0 ? { maxDailyUses: data.maxDailyUses } : {}),
          ...(validDays.length > 0 ? { validDays } : {}),
          ...(data.validTimeStart ? { validTimeStart: data.validTimeStart } : {}),
          ...(data.validTimeEnd ? { validTimeEnd: data.validTimeEnd } : {}),
        },
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Access pass created")
        reset()
        setValidDays([])
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
          <Label htmlFor="access-name">Program Name</Label>
          <Input
            id="access-name"
            {...register("name", { required: "Program name is required" })}
            placeholder="e.g., Gym Access, Building Pass, Pool Entry"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="access-label">Access Label</Label>
          <Input
            id="access-label"
            {...register("accessLabel", { required: "Label is required" })}
            placeholder="e.g., Gym Entry, Pool Access"
          />
          {errors.accessLabel && (
            <p className="text-xs text-destructive">{errors.accessLabel.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="access-duration">Duration</Label>
          <select
            id="access-duration"
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
            <Label htmlFor="access-custom-days">Custom Duration (Days)</Label>
            <Input
              id="access-custom-days"
              type="number"
              min={1}
              max={3650}
              {...register("customDurationDays", { valueAsNumber: true })}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="access-daily-limit">Daily Limit (0 = unlimited)</Label>
          <Input
            id="access-daily-limit"
            type="number"
            min={0}
            max={100}
            {...register("maxDailyUses", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Valid Days (leave empty for all days)</Label>
          <div className="flex flex-wrap gap-2">
            {dayOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleDay(value)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  validDays.includes(value)
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="access-time-start">Valid From (Optional)</Label>
          <Input
            id="access-time-start"
            type="time"
            {...register("validTimeStart")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="access-time-end">Valid Until (Optional)</Label>
          <Input
            id="access-time-end"
            type="time"
            {...register("validTimeEnd")}
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
            "Create Access Pass"
          )}
        </Button>
      </div>
    </form>
  )
}

// ─── Transit Form ────────────────────────────────────────────

type TransitFormData = {
  name: string
  transitType: "bus" | "train" | "ferry" | "flight" | "other"
  originName: string
  destinationName: string
  departureDateTime: string
}

function TransitForm({
  organizationId,
  onCreated,
  onBack,
}: {
  organizationId: string
  onCreated: () => void
  onBack: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TransitFormData>({
    defaultValues: {
      name: "",
      transitType: "bus",
      originName: "",
      destinationName: "",
      departureDateTime: "",
    },
  })

  function onSubmit(data: TransitFormData) {
    startTransition(async () => {
      const result = await createPassTemplate({
        organizationId,
        passType: "TRANSIT",
        name: data.name,
        config: {
          transitType: data.transitType,
          barcodeType: "qr" as const,
          ...(data.originName ? { originName: data.originName } : {}),
          ...(data.destinationName ? { destinationName: data.destinationName } : {}),
          ...(data.departureDateTime ? { departureDateTime: data.departureDateTime } : {}),
        },
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Transit pass created")
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
          <Label htmlFor="transit-name">Program Name</Label>
          <Input
            id="transit-name"
            {...register("name", { required: "Program name is required" })}
            placeholder="e.g., City Bus Pass, Train Ticket"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="transit-type">Transit Type</Label>
          <select
            id="transit-type"
            {...register("transitType")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="bus">Bus</option>
            <option value="train">Train</option>
            <option value="ferry">Ferry</option>
            <option value="flight">Flight</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="transit-departure">Departure (Optional)</Label>
          <Input
            id="transit-departure"
            type="datetime-local"
            {...register("departureDateTime")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="transit-origin">Origin (Optional)</Label>
          <Input
            id="transit-origin"
            {...register("originName")}
            placeholder="e.g., Grand Central"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="transit-destination">Destination (Optional)</Label>
          <Input
            id="transit-destination"
            {...register("destinationName")}
            placeholder="e.g., Penn Station"
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
            "Create Transit Pass"
          )}
        </Button>
      </div>
    </form>
  )
}

// ─── Business ID Form ────────────────────────────────────────

type BusinessIdFormData = {
  name: string
  idLabel: string
  validDuration: "monthly" | "yearly" | "lifetime" | "custom"
  customDurationDays: number
}

function BusinessIdForm({
  organizationId,
  onCreated,
  onBack,
}: {
  organizationId: string
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
  } = useForm<BusinessIdFormData>({
    defaultValues: {
      name: "",
      idLabel: "Employee ID",
      validDuration: "yearly",
      customDurationDays: 365,
    },
  })

  const validDuration = watch("validDuration")

  function onSubmit(data: BusinessIdFormData) {
    startTransition(async () => {
      const result = await createPassTemplate({
        organizationId,
        passType: "BUSINESS_ID",
        name: data.name,
        config: {
          idLabel: data.idLabel,
          validDuration: data.validDuration,
          ...(data.validDuration === "custom" ? { customDurationDays: data.customDurationDays } : {}),
        },
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Business ID created")
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
          <Label htmlFor="bid-name">Program Name</Label>
          <Input
            id="bid-name"
            {...register("name", { required: "Program name is required" })}
            placeholder="e.g., Employee Badge, Student ID, Volunteer Card"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bid-label">ID Label</Label>
          <Input
            id="bid-label"
            {...register("idLabel", { required: "ID label is required" })}
            placeholder="e.g., Employee ID, Student ID"
          />
          {errors.idLabel && (
            <p className="text-xs text-destructive">{errors.idLabel.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bid-duration">Valid Duration</Label>
          <select
            id="bid-duration"
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
            <Label htmlFor="bid-custom-days">Custom Duration (Days)</Label>
            <Input
              id="bid-custom-days"
              type="number"
              min={1}
              max={3650}
              {...register("customDurationDays", { valueAsNumber: true })}
            />
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              Creating...
            </>
          ) : (
            "Create Business ID"
          )}
        </Button>
      </div>
    </form>
  )
}

// ─── Main Component ─────────────────────────────────────────

export function CreateProgramForm({
  organizationId,
  onCreated,
}: {
  organizationId: string
  onCreated: () => void
}) {
  const [selectedType, setSelectedType] = useState<PassType | null>(null)

  if (!selectedType) {
    return <TypeSelector onSelect={setSelectedType} />
  }

  const formProps = {
    organizationId,
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
    case "GIFT_CARD":
      return <GiftCardForm {...formProps} />
    case "TICKET":
      return <TicketForm {...formProps} />
    case "ACCESS":
      return <AccessForm {...formProps} />
    case "TRANSIT":
      return <TransitForm {...formProps} />
    case "BUSINESS_ID":
      return <BusinessIdForm {...formProps} />
  }
}
