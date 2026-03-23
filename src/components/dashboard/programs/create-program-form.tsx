"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Lock, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { createPassTemplate } from "@/server/org-settings-actions"
import { PASS_TYPE_META, type PassType, type PointsCatalogItem } from "@/types/pass-types"
import { useTranslations } from "next-intl"
import type { PassType as PlanPassType } from "@/lib/plans"

// ─── Step 1: Type selector ─────────────────────────────────

function TypeSelector({
  onSelect,
  allowedPassTypes,
}: {
  onSelect: (type: PassType) => void
  allowedPassTypes?: PlanPassType[]
}) {
  const t = useTranslations("dashboard.createProgram")
  const types: PassType[] = [
    "STAMP_CARD", "COUPON", "MEMBERSHIP", "POINTS",
    "GIFT_CARD", "TICKET", "BUSINESS_CARD",
  ]

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("chooseType")}
      </p>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {types.map((type) => {
          const meta = PASS_TYPE_META[type]
          const Icon = meta.icon
          const isLocked = allowedPassTypes && !allowedPassTypes.includes(type as PlanPassType)
          return (
            <Card asChild key={type}>
            <button
              type="button"
              onClick={() => !isLocked && onSelect(type)}
              disabled={isLocked}
              className={`flex flex-col items-start gap-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isLocked
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-muted/30 hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isLocked ? "bg-muted" : "bg-brand/10"}`}>
                  <Icon className={`h-4.5 w-4.5 ${isLocked ? "text-muted-foreground" : "text-brand"}`} />
                </div>
                {isLocked && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" />
                    {t("upgrade")}
                  </Badge>
                )}
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
  const t = useTranslations("dashboard.createProgram")
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
        toast.success(t("stampCardCreated"))
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
        {t("backToTypeSelection")}
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="stamp-name">{t("programName")}</Label>
          <Input
            id="stamp-name"
            {...register("name", { required: t("programNameRequired") })}
            placeholder={t("stampNamePlaceholder")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="stamp-visits">{t("visitsRequired")}</Label>
          <Input
            id="stamp-visits"
            type="number"
            min={3}
            max={30}
            {...register("visitsRequired", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stamp-expiry">{t("rewardExpiry")}</Label>
          <Input
            id="stamp-expiry"
            type="number"
            min={0}
            max={365}
            {...register("rewardExpiryDays", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="stamp-reward">{t("rewardDescription")}</Label>
          <Input
            id="stamp-reward"
            {...register("rewardDescription", {
              required: t("rewardDescriptionRequired"),
            })}
            placeholder={t("rewardDescriptionPlaceholder")}
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
              {t("creating")}
            </>
          ) : (
            t("createStampCard")
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
  const t = useTranslations("dashboard.createProgram")
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
        toast.success(t("couponCreated"))
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
        {t("backToTypeSelection")}
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="coupon-name">{t("couponName")}</Label>
          <Input
            id="coupon-name"
            {...register("name", { required: t("couponNameRequired") })}
            placeholder={t("couponNamePlaceholder")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="coupon-discount-type">{t("discountType")}</Label>
          <select
            id="coupon-discount-type"
            {...register("discountType")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="percentage">{t("discountTypePercentage")}</option>
            <option value="fixed">{t("discountTypeFixed")}</option>
            <option value="freebie">{t("discountTypeFreebie")}</option>
          </select>
        </div>
        {discountType !== "freebie" && (
          <div className="space-y-2">
            <Label htmlFor="coupon-discount-value">
              {discountType === "percentage" ? t("discountPercent") : t("discountDollar")}
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
          <Label htmlFor="coupon-desc">{t("couponDescription")}</Label>
          <Input
            id="coupon-desc"
            {...register("couponDescription")}
            placeholder={t("couponDescriptionPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="coupon-valid-until">{t("validUntilOptional")}</Label>
          <Input
            id="coupon-valid-until"
            type="date"
            {...register("validUntil")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="coupon-limit">{t("redemptionLimit")}</Label>
          <select
            id="coupon-limit"
            {...register("redemptionLimit")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="single">{t("redemptionSingle")}</option>
            <option value="unlimited">{t("redemptionUnlimited")}</option>
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="coupon-terms">{t("termsOptional")}</Label>
          <Textarea
            id="coupon-terms"
            {...register("terms")}
            placeholder={t("termsPlaceholder")}
            rows={3}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              {t("creating")}
            </>
          ) : (
            t("createCoupon")
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
  const t = useTranslations("dashboard.createProgram")
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
        toast.success(t("membershipCreated"))
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
        {t("backToTypeSelection")}
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="member-name">{t("programName")}</Label>
          <Input
            id="member-name"
            {...register("name", { required: t("programNameRequired") })}
            placeholder={t("memberProgramNamePlaceholder")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-tier">{t("membershipTier")}</Label>
          <Input
            id="member-tier"
            {...register("membershipTier", {
              required: t("membershipTierRequired"),
            })}
            placeholder={t("membershipTierPlaceholder")}
          />
          {errors.membershipTier && (
            <p className="text-xs text-destructive">
              {errors.membershipTier.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-duration">{t("duration")}</Label>
          <select
            id="member-duration"
            {...register("validDuration")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="monthly">{t("durationMonthly")}</option>
            <option value="yearly">{t("durationYearly")}</option>
            <option value="lifetime">{t("durationLifetime")}</option>
            <option value="custom">{t("durationCustom")}</option>
          </select>
        </div>
        {validDuration === "custom" && (
          <div className="space-y-2">
            <Label htmlFor="member-custom-days">{t("customDurationDays")}</Label>
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
          <Label htmlFor="member-benefits">{t("benefits")}</Label>
          <Textarea
            id="member-benefits"
            {...register("benefits", { required: t("benefitsRequired") })}
            placeholder={t("benefitsPlaceholder")}
            rows={3}
          />
          {errors.benefits && (
            <p className="text-xs text-destructive">
              {errors.benefits.message}
            </p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="member-terms">{t("termsOptional")}</Label>
          <Textarea
            id="member-terms"
            {...register("terms")}
            placeholder={t("termsPlaceholder")}
            rows={3}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              {t("creating")}
            </>
          ) : (
            t("createMembership")
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
  const t = useTranslations("dashboard.createProgram")
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
      toast.error(t("catalogValidationError"))
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
        toast.success(t("pointsProgramCreated"))
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
        {t("backToTypeSelection")}
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="points-name">{t("programName")}</Label>
          <Input
            id="points-name"
            {...register("name", { required: t("programNameRequired") })}
            placeholder={t("pointsProgramNamePlaceholder")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="points-per-visit">{t("pointsPerVisit")}</Label>
          <Input
            id="points-per-visit"
            type="number"
            min={1}
            max={100}
            {...register("pointsPerVisit", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="points-expiry">{t("rewardExpiryDays")}</Label>
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
          <Label>{t("rewardCatalog")}</Label>
          <span className="text-xs text-muted-foreground">{t("catalogCount", { count: catalog.length })}</span>
        </div>
        <div className="space-y-2">
          {catalog.map((item, index) => (
            <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] items-start rounded-md border border-border bg-muted/20 p-3">
              <div className="space-y-1">
                <Label htmlFor={`catalog-name-${item.id}`} className="text-xs text-muted-foreground">
                  {t("catalogName")} <span className="text-destructive">{t("catalogNameRequired")}</span>
                </Label>
                <Input
                  id={`catalog-name-${item.id}`}
                  value={item.name}
                  onChange={(e) => updateCatalogItem(item.id, "name", e.target.value)}
                  placeholder={t("catalogNamePlaceholder")}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`catalog-desc-${item.id}`} className="text-xs text-muted-foreground">
                  {t("catalogDescription")}
                </Label>
                <Input
                  id={`catalog-desc-${item.id}`}
                  value={item.description}
                  onChange={(e) => updateCatalogItem(item.id, "description", e.target.value)}
                  placeholder={t("catalogDescriptionPlaceholder")}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`catalog-cost-${item.id}`} className="text-xs text-muted-foreground">
                  {t("catalogPointsCost")} <span className="text-destructive">*</span>
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
                  aria-label={t("removeCatalogItem", { index: index + 1 })}
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
          {t("addCatalogItem")}
        </Button>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              {t("creating")}
            </>
          ) : (
            t("createPointsProgram")
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
  const t = useTranslations("dashboard.createProgram")
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
        toast.success(t("giftCardCreated"))
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
        {t("backToTypeSelection")}
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="gift-name">{t("giftCardName")}</Label>
          <Input
            id="gift-name"
            {...register("name", { required: t("giftCardNameRequired") })}
            placeholder={t("giftCardNamePlaceholder")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="gift-currency">{t("currency")}</Label>
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
          <Label htmlFor="gift-balance">{t("initialBalance")}</Label>
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
          <Label htmlFor="gift-partial">{t("partialRedemption")}</Label>
          <select
            id="gift-partial"
            {...register("partialRedemption", { setValueAs: (v) => v === "true" || v === true })}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="true">{t("partialRedemptionYes")}</option>
            <option value="false">{t("partialRedemptionNo")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gift-expiry">{t("expiryMonths")}</Label>
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
              {t("creating")}
            </>
          ) : (
            t("createGiftCard")
          )}
        </Button>
      </div>
    </form>
  )
}

// ─── Business Card Form ──────────────────────────────────────

type BusinessCardFormData = {
  name: string
  contactName: string
  jobTitle: string
  phone: string
  email: string
  website: string
}

function BusinessCardForm({
  organizationId,
  onCreated,
  onBack,
}: {
  organizationId: string
  onCreated: () => void
  onBack: () => void
}) {
  const t = useTranslations("dashboard.createProgram")
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BusinessCardFormData>({
    defaultValues: {
      name: "",
      contactName: "",
      jobTitle: "",
      phone: "",
      email: "",
      website: "",
    },
  })

  function onSubmit(data: BusinessCardFormData) {
    startTransition(async () => {
      const result = await createPassTemplate({
        organizationId,
        passType: "BUSINESS_CARD",
        name: data.name,
        config: {
          contactName: data.contactName,
          jobTitle: data.jobTitle || undefined,
          phone: data.phone || undefined,
          email: data.email || undefined,
          website: data.website || undefined,
        },
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success(t("businessCardCreated"))
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
        {t("backToTypeSelection")}
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bc-name">{t("programName")}</Label>
          <Input
            id="bc-name"
            {...register("name", { required: t("programNameRequired") })}
            placeholder={t("businessCardNamePlaceholder")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bc-contact-name">{t("contactName")}</Label>
          <Input
            id="bc-contact-name"
            {...register("contactName", { required: t("contactNameRequired") })}
            placeholder={t("contactNamePlaceholder")}
          />
          {errors.contactName && (
            <p className="text-xs text-destructive">{errors.contactName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bc-job-title">{t("jobTitle")}</Label>
          <Input
            id="bc-job-title"
            {...register("jobTitle")}
            placeholder={t("jobTitlePlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bc-phone">{t("phone")}</Label>
          <Input
            id="bc-phone"
            {...register("phone")}
            placeholder={t("phonePlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bc-email">{t("bcEmail")}</Label>
          <Input
            id="bc-email"
            type="email"
            {...register("email")}
            placeholder={t("emailPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bc-website">{t("bcWebsite")}</Label>
          <Input
            id="bc-website"
            {...register("website")}
            placeholder={t("websitePlaceholder")}
          />
        </div>
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        {t("createBusinessCard")}
      </Button>
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
  const t = useTranslations("dashboard.createProgram")
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
        toast.success(t("ticketCreated"))
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
        {t("backToTypeSelection")}
      </button>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ticket-name">{t("programName")}</Label>
          <Input
            id="ticket-name"
            {...register("name", { required: t("programNameRequired") })}
            placeholder={t("ticketProgramNamePlaceholder")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ticket-event-name">{t("eventName")}</Label>
          <Input
            id="ticket-event-name"
            {...register("eventName", { required: t("eventNameRequired") })}
            placeholder={t("eventNamePlaceholder")}
          />
          {errors.eventName && (
            <p className="text-xs text-destructive">{errors.eventName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ticket-event-date">{t("eventDate")}</Label>
          <Input
            id="ticket-event-date"
            type="date"
            {...register("eventDate", { required: t("eventDateRequired") })}
          />
          {errors.eventDate && (
            <p className="text-xs text-destructive">{errors.eventDate.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ticket-max-scans">{t("maxScans")}</Label>
          <Input
            id="ticket-max-scans"
            type="number"
            min={1}
            max={100}
            {...register("maxScans", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ticket-venue">{t("venue")}</Label>
          <Input
            id="ticket-venue"
            {...register("eventVenue", { required: t("venueRequired") })}
            placeholder={t("venuePlaceholder")}
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
              {t("creating")}
            </>
          ) : (
            t("createTicket")
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
  allowedPassTypes,
}: {
  organizationId: string
  onCreated: () => void
  allowedPassTypes?: PlanPassType[]
}) {
  const [selectedType, setSelectedType] = useState<PassType | null>(null)

  if (!selectedType) {
    return <TypeSelector onSelect={setSelectedType} allowedPassTypes={allowedPassTypes} />
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
    case "GIFT_CARD":
      return <GiftCardForm {...formProps} />
    case "TICKET":
      return <TicketForm {...formProps} />
    case "BUSINESS_CARD":
      return <BusinessCardForm {...formProps} />
  }
}
