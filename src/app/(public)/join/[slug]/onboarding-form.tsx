"use client"

import { useState, useEffect, useTransition, useRef } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import {
  CreditCard,
  Loader2,
  ArrowLeft,
  Gift,
  ChevronRight,
  Globe,
  Stamp,
  Tag,
  Users,
  Star,
  Wallet,
  Ticket,
  KeyRound,
  Train,
  BadgeCheck,
} from "lucide-react"
import { joinTemplate, requestWalletPass } from "@/server/onboarding-actions"
import type { OrganizationPublicInfo, JoinResult } from "@/server/onboarding-actions"
import type { PublicTemplateInfo } from "@/types/pass-instance"

import { TemplateCardPreview } from "@/components/template-card-preview"
import { Card } from "@/components/ui/card"

function getVisitsRequired(p: PublicTemplateInfo): number {
  const cfg = p.config as Record<string, unknown> | null
  if (cfg && typeof cfg.stampsRequired === "number") return cfg.stampsRequired
  return 10
}

function getRewardDescription(p: PublicTemplateInfo): string {
  const cfg = p.config as Record<string, unknown> | null
  if (cfg && typeof cfg.rewardDescription === "string") return cfg.rewardDescription
  return p.description ?? p.name
}

function getPassTypeIcon(passType: string) {
  switch (passType) {
    case "STAMP_CARD": return Stamp
    case "COUPON": return Tag
    case "MEMBERSHIP": return Users
    case "POINTS": return Star
    case "PREPAID": return Wallet
    case "GIFT_CARD": return Gift
    case "TICKET": return Ticket
    case "ACCESS": return KeyRound
    case "TRANSIT": return Train
    case "BUSINESS_ID": return BadgeCheck
    default: return CreditCard
  }
}

function getProgramSubtitle(p: PublicTemplateInfo, t: ReturnType<typeof useTranslations>): string {
  const reward = getRewardDescription(p)
  switch (p.passType) {
    case "STAMP_CARD":
      return t("stampSubtitle", { reward, visits: getVisitsRequired(p) })
    case "COUPON":
    case "MEMBERSHIP":
    case "BUSINESS_ID":
      return reward
    case "POINTS":
      return t("pointsSubtitle", { reward })
    case "PREPAID":
      return t("prepaidSubtitle", { reward })
    case "GIFT_CARD":
      return t("giftCardSubtitle", { reward })
    case "TICKET":
    case "ACCESS":
    case "TRANSIT":
      return reward
    default:
      return reward
  }
}

/** Pass types where showing the reward/info badge on the join form makes sense */
function shouldShowInfoBadge(passType: string): boolean {
  switch (passType) {
    case "STAMP_CARD":
    case "COUPON":
    case "POINTS":
    case "PREPAID":
    case "GIFT_CARD":
    case "MEMBERSHIP":
      return true
    case "TICKET":
    case "ACCESS":
    case "TRANSIT":
    case "BUSINESS_ID":
      return false
    default:
      return false
  }
}

type Platform = "apple" | "google"
type Step = "program-select" | "form"

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "apple"
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod|macintosh/.test(ua) && "ontouchend" in document) return "apple"
  if (/android/.test(ua)) return "google"
  return "apple"
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && "ontouchend" in document)
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false
  return /android/i.test(navigator.userAgent)
}

type OnboardingFormProps = {
  organization: OrganizationPublicInfo
  preselectedTemplateId?: string
}

export function OnboardingForm({ organization, preselectedTemplateId }: OnboardingFormProps) {
  const t = useTranslations("join")
  const programs = organization.templates
  const hasMultiplePrograms = programs.length > 1

  const preselected = preselectedTemplateId
    ? programs.find((p) => p.id === preselectedTemplateId) ?? null
    : null

  const [selectedProgram, setSelectedProgram] = useState<PublicTemplateInfo | null>(
    preselected ?? (hasMultiplePrograms ? null : programs[0] ?? null)
  )
  const [step, setStep] = useState<Step>(
    preselected || !hasMultiplePrograms ? "form" : "program-select"
  )
  const [platform, setPlatform] = useState<Platform>("apple")
  const [showBothPlatforms, setShowBothPlatforms] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [loadingLabel, setLoadingLabel] = useState(t("settingUp"))
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const detected = detectPlatform()
    setPlatform(detected)
    if (!isIOS() && !isAndroid()) {
      setShowBothPlatforms(true)
    }
  }, [])

  const activeProgram = selectedProgram ?? programs[0]
  const design = activeProgram?.passDesign
  const brandColor = design?.primaryColor ?? organization.brandColor ?? "oklch(0.55 0.2 265)"


  const fontFamilyCss: Record<string, string> = {
    SANS: "inherit",
    SERIF: "Georgia, Cambria, 'Times New Roman', serif",
    ROUNDED: "'SF Pro Rounded', system-ui, sans-serif",
    MONO: "var(--font-geist-mono), 'Courier New', monospace",
  }
  const webFont = fontFamilyCss[design?.fontFamily ?? "SANS"] ?? "inherit"

  function handleProgramSelect(program: PublicTemplateInfo) {
    setSelectedProgram(program)
    setStep("form")
  }

  function getFormData(): FormData | null {
    const form = formRef.current
    if (!form) return null
    if (!form.reportValidity()) return null
    return new FormData(form)
  }

  // Combined: create pass + generate wallet + open wallet — one tap
  function handleSubmitAndAddToWallet(formData: FormData, chosenPlatform: Platform) {
    setError(null)
    formData.set("organizationSlug", organization.slug)
    if (selectedProgram) {
      formData.set("templateId", selectedProgram.id)
    }

    startTransition(async () => {
      // Step 1: Find or create pass instance
      setLoadingLabel(t("settingUp"))
      const joinRes = await joinTemplate(formData)

      if (!joinRes.success) {
        setError(joinRes.error ?? t("somethingWentWrong"))
        return
      }

      // Step 2: Generate wallet pass
      setLoadingLabel(joinRes.isReturning ? t("updatingWallet") : t("addingToWallet"))
      const walletRes = await requestWalletPass(
        joinRes.passInstanceId!,
        organization.slug,
        chosenPlatform
      )

      if (!walletRes.success) {
        // Pass was created but wallet generation failed — redirect to card page
        if (joinRes.cardUrl) {
          window.location.href = joinRes.cardUrl
        }
        return
      }

      // Step 3: Deliver wallet pass
      if (walletRes.platform === "apple" && walletRes.passBuffer) {
        const bytes = Uint8Array.from(atob(walletRes.passBuffer), (c) => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: "application/vnd.apple.pkpass" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${organization.slug}-pass.pkpass`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        // Redirect to card page after a brief moment (pass opens in Wallet)
        if (joinRes.cardUrl) {
          setTimeout(() => {
            window.location.href = joinRes.cardUrl!
          }, 1500)
        }
      } else if (walletRes.platform === "google" && walletRes.saveUrl) {
        window.location.href = walletRes.saveUrl
        return
      }
    })
  }

  // Submit without wallet — just create pass and go to card page
  function handleSubmitWithoutWallet(formData: FormData) {
    setError(null)
    formData.set("organizationSlug", organization.slug)
    if (selectedProgram) {
      formData.set("templateId", selectedProgram.id)
    }

    startTransition(async () => {
      setLoadingLabel(t("settingUp"))
      const res = await joinTemplate(formData)

      if (!res.success) {
        setError(res.error ?? t("somethingWentWrong"))
        return
      }

      if (res.isReturning) {
        setLoadingLabel(t("welcomeBack"))
      }

      if (res.cardUrl) {
        window.location.href = res.cardUrl
      }
    })
  }

  // --- Program selection screen (multi-program only) ---
  if (step === "program-select") {
    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center p-4"
        style={{
          background: `linear-gradient(to bottom, color-mix(in oklch, ${brandColor} 6%, var(--background)) 0%, var(--background) 60%)`,
        }}
      >
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            {(organization.logoGoogle ?? organization.logo) && (
              <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden bg-muted">
                <Image
                  src={(organization.logoGoogle ?? organization.logo)!}
                  alt={organization.name}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {organization.name}
              </h1>
              <p className="text-muted-foreground text-[15px]">
                {t("chooseProgram")}
              </p>
            </div>
          </div>

          {/* Program cards */}
          <div className="space-y-3">
            {programs.map((program) => (
              <Card asChild key={program.id}>
                <button
                  onClick={() => handleProgramSelect(program)}
                  className="w-full text-left p-4 hover:bg-accent/50 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="shrink-0 rounded-lg overflow-hidden" style={{ width: 56, height: 72 }}>
                      <TemplateCardPreview
                        template={program}
                        organizationName={organization.name}
                        logoUrl={organization.logo}
                        logoAppleUrl={organization.logoApple}
                        logoGoogleUrl={organization.logoGoogle}
                        compact
                        width={56}
                        height={72}
                        currentVisits={0}
                        rewardDescription=""
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate">
                        {program.name}
                      </h3>
                      <p className="text-[13px] text-muted-foreground mt-0.5">
                        {getProgramSubtitle(program, t)}
                      </p>
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  </div>
                </button>
              </Card>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
              {t("freePass")}
            </div>
            <p className="text-[11px] text-muted-foreground/70">
              {t("poweredBy", { brand: "Loyalshy" })}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // --- Form screen ---
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center p-4"
      style={{
        fontFamily: webFont,
        background: `linear-gradient(to bottom, color-mix(in oklch, ${brandColor} 6%, var(--background)) 0%, var(--background) 60%)`,
      }}
    >
      <div className="w-full max-w-[320px] space-y-5">
        {/* Back button for multi-program */}
        {hasMultiplePrograms && (
          <button
            onClick={() => {
              setStep("program-select")
              setSelectedProgram(null)
              setError(null)
            }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("chooseDifferent")}
          </button>
        )}

        {/* Card preview — hero position */}
        {activeProgram && (
          <TemplateCardPreview
            template={activeProgram}
            organizationName={organization.name}
            logoUrl={organization.logo}
            logoAppleUrl={organization.logoApple}
            logoGoogleUrl={organization.logoGoogle}
            customerName={name.trim() || undefined}
            currentVisits={0}
          />
        )}

        {/* Info badge + custom message */}
        <div className="text-center space-y-3">
          {activeProgram && shouldShowInfoBadge(activeProgram.passType) && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium bg-muted text-muted-foreground">
              {(() => { const Icon = getPassTypeIcon(activeProgram.passType); return <Icon className="w-3.5 h-3.5" aria-hidden="true" /> })()}
              {getProgramSubtitle(activeProgram, t)}
            </div>
          )}

          {design?.customMessage && (
            <div className="rounded-lg bg-muted/50 px-4 py-3 text-left">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {design.customMessage}
              </p>
            </div>
          )}
        </div>

        {/* Form — fields first, card preview after */}
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            handleSubmitAndAddToWallet(formData, platform)
          }}
          className="space-y-4"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="text-[13px] font-medium text-foreground">
              {t("yourName")} <span className="text-destructive">*</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              autoComplete="name"
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex h-10 w-full rounded-full border border-input bg-background px-4 py-2 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-foreground/30 transition-colors"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[13px] font-medium text-foreground">
              {t("email")} <span className="text-destructive">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              className="flex h-10 w-full rounded-full border border-input bg-background px-4 py-2 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-foreground/30 transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Wallet buttons — primary action */}
          {isPending ? (
            <div className="flex items-center justify-center gap-2 h-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">{loadingLabel}</span>
            </div>
          ) : showBothPlatforms ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const formData = getFormData()
                  if (formData) handleSubmitAndAddToWallet(formData, "apple")
                }}
                disabled={isPending}
                className="transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Add to Apple Wallet"
              >
                <Image
                  src="/wallet-buttons/US-UK_Add_to_Apple_Wallet_RGB_101421.svg"
                  alt="Add to Apple Wallet"
                  width={156}
                  height={48}
                  className="h-12 w-auto"
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  const formData = getFormData()
                  if (formData) handleSubmitAndAddToWallet(formData, "google")
                }}
                disabled={isPending}
                className="transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Add to Google Wallet"
              >
                <Image
                  src="/wallet-buttons/enGB_add_to_google_wallet_add-wallet-badge.svg"
                  alt="Add to Google Wallet"
                  width={176}
                  height={48}
                  className="h-12 w-auto"
                />
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={isPending}
              className="transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center w-full"
              aria-label={`Add to ${platform === "apple" ? "Apple" : "Google"} Wallet`}
            >
              <Image
                src={platform === "apple"
                  ? "/wallet-buttons/US-UK_Add_to_Apple_Wallet_RGB_101421.svg"
                  : "/wallet-buttons/enGB_add_to_google_wallet_add-wallet-badge.svg"
                }
                alt={`Add to ${platform === "apple" ? "Apple" : "Google"} Wallet`}
                width={platform === "apple" ? 156 : 176}
                height={48}
                className="h-12 w-auto"
              />
            </button>
          )}

          {/* Web-only pass — skip wallet, get a shareable link */}
          {!isPending && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                const formData = getFormData()
                if (formData) handleSubmitWithoutWallet(formData)
              }}
              className="flex w-full items-center justify-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              {t("webPassInstead")}
            </button>
          )}
        </form>

        {/* Footer */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
            {t("freePass")}
          </div>
          <p className="text-[11px] text-muted-foreground/70">
            {t("poweredBy", { brand: "Loyalshy" })}
          </p>
        </div>
      </div>
    </div>
  )
}
