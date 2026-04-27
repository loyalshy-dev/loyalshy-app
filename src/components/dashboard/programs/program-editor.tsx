"use client"

import { useState, useTransition, useEffect, useRef, useCallback } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
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
import { parseCouponConfig, parseMinigameConfig } from "@/lib/pass-config"
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
  const t = useTranslations("dashboard.programEditor")
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

  // Extract stamp-card flat fields from config JSON
  const stampConfig = program.config as Record<string, unknown> | null ?? {}
  const programVisitsRequired = (stampConfig.stampsRequired as number) ?? (stampConfig.visitsRequired as number) ?? 10
  const programRewardDescription = (stampConfig.rewardDescription as string) ?? ""
  const programRewardExpiryDays = (stampConfig.rewardExpiryDays as number) ?? 90

  const couponConfig = isCoupon ? parseCouponConfig(program.config) : null
  const minigameConfig = (isStampCard || isCoupon) ? parseMinigameConfig(program.config) : null
  const hasPrizes = !!(minigameConfig?.enabled && minigameConfig.prizes?.length)

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
    },
  })

  const visitsRequired = watch("visitsRequired")
  const visitsChanged =
    Number(visitsRequired) !== programVisitsRequired
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
        toast.success(t("programUpdated"))
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
        toast.success(t("programArchived"))
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
        toast.success(t("programActivated"))
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
        toast.success(t("programReactivated"))
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
        toast.success(t("programDeleted"))
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
    { id: "details", label: t("details") },
    ...(isStampCard ? [{ id: "stamps", label: t("stamps") }] : []),
    ...(isCoupon ? [{ id: "coupon", label: t("coupon") }] : []),
    { id: "schedule", label: t("schedule") },
    { id: "terms", label: t("terms") },
    ...((isStampCard || isCoupon) ? [{ id: "prize-reveal", label: t("prizeReveal") }] : []),
    { id: "danger", label: t("danger") },
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
              <h3 className="text-sm font-semibold">{t("programDetails")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t("programDetailsDesc")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`name-${program.id}`}>{t("programName")}</Label>
              <Input
                id={`name-${program.id}`}
                {...register("name", { required: t("programNameRequired") })}
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
                <h3 className="text-sm font-semibold">{t("stampConfiguration")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t("stampConfigDesc")}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`visits-${program.id}`}>{t("visitsRequired")}</Label>
                  <Input
                    id={`visits-${program.id}`}
                    type="number"
                    min={3}
                    max={30}
                    {...register("visitsRequired", { valueAsNumber: true })}
                    disabled={isArchived}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("visitsRequiredHint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`expiry-${program.id}`}>
                    {t("rewardExpiry")}
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
                    {t("rewardExpiryHint")}
                  </p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`reward-${program.id}`}>{t("rewardDescription")}</Label>
                  <Input
                    id={`reward-${program.id}`}
                    {...register("rewardDescription", {
                      required: t("rewardDescriptionRequired"),
                    })}
                    placeholder={t("rewardDescriptionPlaceholder")}
                    disabled={isArchived || hasPrizes}
                  />
                  {hasPrizes ? (
                    <p className="text-xs text-muted-foreground">
                      {t("rewardDescriptionFromPrizes")}
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
                <h3 className="text-sm font-semibold">{t("couponConfiguration")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t("couponConfigDesc")}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`discount-type-${program.id}`}>{t("discountType")}</Label>
                  <select
                    id={`discount-type-${program.id}`}
                    {...register("discountType")}
                    disabled={isArchived}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="percentage">{t("discountTypePercentage")}</option>
                    <option value="fixed">{t("discountTypeFixed")}</option>
                    <option value="freebie">{t("discountTypeFreebie")}</option>
                  </select>
                </div>
                {discountType !== "freebie" && (
                  <div className="space-y-2">
                    <Label htmlFor={`discount-value-${program.id}`}>
                      {discountType === "percentage" ? t("discountPercent") : t("discountAmount")}
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
                  <Label htmlFor={`reward-${program.id}`}>{t("couponDescription")}</Label>
                  <Input
                    id={`reward-${program.id}`}
                    {...register("rewardDescription", {
                      required: t("couponDescriptionRequired"),
                    })}
                    placeholder={t("couponDescriptionPlaceholder")}
                    disabled={isArchived || hasPrizes}
                  />
                  {hasPrizes ? (
                    <p className="text-xs text-muted-foreground">
                      {t("rewardDescriptionFromPrizes")}
                    </p>
                  ) : errors.rewardDescription ? (
                    <p className="text-xs text-destructive">
                      {errors.rewardDescription.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`valid-until-${program.id}`}>{t("validUntil")}</Label>
                  <Input
                    id={`valid-until-${program.id}`}
                    type="date"
                    {...register("validUntil")}
                    disabled={isArchived}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`coupon-code-${program.id}`}>{t("couponCode")}</Label>
                  <Input
                    id={`coupon-code-${program.id}`}
                    {...register("couponCode")}
                    placeholder={t("couponCodePlaceholder")}
                    disabled={isArchived}
                  />
                  <p className="text-xs text-muted-foreground">{t("couponCodeHint")}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`redemption-limit-${program.id}`}>{t("redemptionLimit")}</Label>
                  <select
                    id={`redemption-limit-${program.id}`}
                    {...register("redemptionLimit")}
                    disabled={isArchived}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="single">{t("redemptionSingle")}</option>
                    <option value="unlimited">{t("redemptionUnlimited")}</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* ─── Section 3: Schedule ────────────────────────────── */}
          <section id="schedule" className="scroll-mt-24 space-y-4 border-t border-border pt-6">
            <div>
              <h3 className="text-sm font-semibold">{t("scheduleSection")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t("scheduleDesc")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`status-${program.id}`}>{t("status")}</Label>
                <select
                  id={`status-${program.id}`}
                  {...register("status")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isArchived}
                >
                  <option value="DRAFT">{t("statusDraft")}</option>
                  <option value="ACTIVE">{t("statusActive")}</option>
                  <option value="ARCHIVED">{t("statusArchived")}</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {isStampCard ? t("statusHintVisits") : t("statusHintCustomers")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`starts-${program.id}`}>{t("startDate")}</Label>
                <Input
                  id={`starts-${program.id}`}
                  type="date"
                  {...register("startsAt")}
                  disabled={isArchived}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`ends-${program.id}`}>{t("endDate")}</Label>
                <Input
                  id={`ends-${program.id}`}
                  type="date"
                  {...register("endsAt")}
                  disabled={isArchived}
                />
                <p className="text-xs text-muted-foreground">
                  {t("endDateHint")}
                </p>
              </div>
            </div>
          </section>

          {/* ─── Section 4: Terms & Conditions ──────────────────── */}
          <section id="terms" className="scroll-mt-24 space-y-4 border-t border-border pt-6">
            <div>
              <h3 className="text-sm font-semibold">{t("termsSection")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t("termsDesc")}</p>
            </div>
            <div className="space-y-2">
              <Textarea
                id={`terms-${program.id}`}
                {...register("termsAndConditions")}
                placeholder={t("termsPlaceholder")}
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
                  primaryColor: program.passDesign?.primaryColor ?? undefined,
                  secondaryColor: program.passDesign?.secondaryColor ?? undefined,
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
                      {t("visitsChangedTitle", { from: programVisitsRequired, to: visitsRequired })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("visitsChangedDesc")}
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
                        {t("keepProgress")}
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
                        {t("resetProgress")}
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
                  {t("cardDesign")}
                </Link>
              </Button>
            </div>

            {(isDirty || showWarning) && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-warning font-medium">
                  {t("unsavedChanges")}
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
                    ? t("saving")
                    : showWarning
                      ? t("confirmSave")
                      : t("saveChanges")}
                </Button>
              </div>
            )}
          </div>

          {/* ─── Section 6: Danger Zone ─────────────────────────── */}
          <section id="danger" className="scroll-mt-24 space-y-4 border-t border-destructive/30 pt-6">
            <h3 className="text-sm font-semibold text-destructive">{t("dangerZone")}</h3>

            {/* Activate (DRAFT only) */}
            {isDraft && (
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{t("activateProgram")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("activateProgramDesc")}
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
                  {t("activate")}
                </Button>
              </div>
            )}

            {/* Archive (ACTIVE only) */}
            {program.status === "ACTIVE" && (
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{t("archiveProgram")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("archiveProgramDesc")}
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
                  {t("archive")}
                </Button>
              </div>
            )}

            {/* Reactivate (ARCHIVED only) */}
            {isArchived && (
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{t("reactivateProgram")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("reactivateProgramDesc")}
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
                  {t("reactivate")}
                </Button>
              </div>
            )}

            {/* Delete (all statuses) */}
            <div className="flex items-center justify-between gap-4 border-t border-destructive/20 pt-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t("deleteProgram")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("deleteProgramDesc")}
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
                {t("delete")}
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
            <AlertDialogTitle>{t("archiveDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("archiveDialogDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDangerPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={handleArchive}
              disabled={isDangerPending}
            >
              {isDangerPending ? t("archiving") : t("archiveConfirmBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate AlertDialog */}
      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reactivateDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("reactivateDialogDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDangerPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={handleReactivate}
              disabled={isDangerPending}
            >
              {isDangerPending ? t("reactivating") : t("reactivateConfirmBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog (with name confirmation) */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteDialogDesc")}
            </DialogDescription>
          </DialogHeader>

          {deleteCounts && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm space-y-1">
              <p className="font-medium text-destructive">{t("dataToDelete")}</p>
              <ul className="list-disc list-inside text-muted-foreground text-xs space-y-0.5">
                <li>{t("passInstancesCount", { count: deleteCounts.passInstances })}</li>
                <li>{t("interactionsCount", { count: deleteCounts.interactions })}</li>
                <li>{t("rewardsCount", { count: deleteCounts.rewards })}</li>
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              {t("typeToConfirm", { name: program.name })}
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
              {isDangerPending ? t("deleting") : t("deleteConfirmBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
