"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import Image from "next/image"
import { ArrowLeft, Loader2, Percent, Euro, Gift } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createPassTemplate } from "@/server/org-settings-actions"
import { PASS_TYPE_META, type PassType } from "@/types/pass-types"
import { useTranslations } from "next-intl"

// ─── Step 1: Type selector ─────────────────────────────────

function TypeSelector({ onSelect }: { onSelect: (type: PassType) => void }) {
  const types: PassType[] = ["STAMP_CARD", "COUPON"]

  return (
    <div className="space-y-4">
      <div className="grid gap-2.5 grid-cols-2">
        {types.map((type) => {
          const meta = PASS_TYPE_META[type]
          const Icon = meta.icon
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className="group relative flex flex-col rounded-xl border border-border bg-card text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden hover:border-foreground/20 hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="relative w-full aspect-4/3 bg-muted/40 overflow-hidden">
                {meta.image ? (
                  <Image
                    src={meta.image}
                    alt={meta.label}
                    fill
                    className="object-contain p-2 transition-transform duration-150 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Icon className="size-10 text-muted-foreground/40" strokeWidth={1.5} />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 p-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-brand" />
                  <p className="text-[13px] font-semibold truncate">{meta.label}</p>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
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

      <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
        {/* Form fields */}
        <div className="grid gap-4 sm:grid-cols-2 content-start">
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
            <div className="relative">
              <Input
                id="stamp-visits"
                type="number"
                min={3}
                max={30}
                className="pr-14"
                {...register("visitsRequired", { valueAsNumber: true })}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-muted-foreground">
                {t("stampsSuffix")}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("visitsRequiredHint")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stamp-expiry">{t("rewardExpiry")}</Label>
            <div className="relative">
              <Input
                id="stamp-expiry"
                type="number"
                min={0}
                max={365}
                className="pr-12"
                {...register("rewardExpiryDays", { valueAsNumber: true })}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-muted-foreground">
                {t("daysSuffix")}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("rewardExpiryHint")}</p>
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

        {/* Preview */}
        <div className="hidden lg:flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-3">
          <p className="self-start text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("previewLabel")}
          </p>
          {PASS_TYPE_META.STAMP_CARD.image && (
            <div className="relative w-full aspect-[3/4]">
              <Image
                src={PASS_TYPE_META.STAMP_CARD.image}
                alt={PASS_TYPE_META.STAMP_CARD.label}
                fill
                className="object-contain"
                sizes="240px"
              />
            </div>
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
    setValue,
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
  const watchedRedemptionLimit = watch("redemptionLimit")

  const today = new Date().toISOString().slice(0, 10)

  const discountTypeOptions = [
    { value: "percentage" as const, icon: Percent, label: t("discountTypePercentage"), desc: t("discountTypePercentageDesc") },
    { value: "fixed" as const, icon: Euro, label: t("discountTypeFixed"), desc: t("discountTypeFixedDesc") },
    { value: "freebie" as const, icon: Gift, label: t("discountTypeFreebie"), desc: t("discountTypeFreebieDesc") },
  ]

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

      const rewardDesc = data.discountType === "percentage"
        ? `${data.discountValue}% off`
        : data.discountType === "fixed"
          ? `€${data.discountValue} off`
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

      <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
        {/* Form fields */}
        <div className="grid gap-4 sm:grid-cols-2 content-start">
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

          {/* Discount type — visual radio cards */}
          <div className="space-y-2 sm:col-span-2">
            <Label>{t("discountType")}</Label>
            <input type="hidden" {...register("discountType")} />
            <div role="radiogroup" className="grid grid-cols-3 gap-2">
              {discountTypeOptions.map((opt) => {
                const Icon = opt.icon
                const selected = discountType === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setValue("discountType", opt.value, { shouldDirty: true })}
                    className={`group flex flex-col items-start gap-1.5 rounded-lg border p-2.5 text-left transition-all ${
                      selected
                        ? "border-brand bg-brand/5 ring-1 ring-brand/40"
                        : "border-border bg-card hover:border-foreground/20"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${selected ? "text-brand" : "text-muted-foreground"}`} strokeWidth={2} />
                    <p className="text-[12px] font-semibold leading-tight">{opt.label}</p>
                    <p className="text-[10px] leading-snug text-muted-foreground line-clamp-2">{opt.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {discountType !== "freebie" && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="coupon-discount-value">
                {discountType === "percentage" ? t("discountPercent") : t("discountDollar")}
              </Label>
              <div className="relative">
                <Input
                  id="coupon-discount-value"
                  type="number"
                  min={1}
                  max={discountType === "percentage" ? 100 : 10000}
                  className="pr-10"
                  {...register("discountValue", { valueAsNumber: true })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] font-medium text-muted-foreground">
                  {discountType === "percentage" ? "%" : "€"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {discountType === "percentage" ? t("discountValueHintPercent") : t("discountValueHintCurrency")}
              </p>
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="coupon-desc">{t("couponDescription")}</Label>
            <Input
              id="coupon-desc"
              {...register("couponDescription")}
              placeholder={
                discountType === "freebie"
                  ? t("couponDescriptionFreebiePlaceholder")
                  : t("couponDescriptionPlaceholder")
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coupon-valid-until">{t("validUntilOptional")}</Label>
            <Input
              id="coupon-valid-until"
              type="date"
              min={today}
              {...register("validUntil")}
            />
            <p className="text-[11px] text-muted-foreground">{t("validUntilHint")}</p>
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
            <p className="text-[11px] text-muted-foreground">
              {watchedRedemptionLimit === "single" ? t("redemptionSingleHint") : t("redemptionUnlimitedHint")}
            </p>
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

        {/* Preview */}
        <div className="hidden lg:flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-3">
          <p className="self-start text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("previewLabel")}
          </p>
          {PASS_TYPE_META.COUPON.image && (
            <div className="relative w-full aspect-[3/4]">
              <Image
                src={PASS_TYPE_META.COUPON.image}
                alt={PASS_TYPE_META.COUPON.label}
                fill
                className="object-contain"
                sizes="240px"
              />
            </div>
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
            t("createCoupon")
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
  }
}
