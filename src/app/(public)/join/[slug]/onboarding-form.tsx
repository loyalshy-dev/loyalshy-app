"use client"

import { useState, useEffect, useTransition } from "react"
import Image from "next/image"
import {
  CreditCard,
  Check,
  Loader2,
  ArrowLeft,
  Gift,
  ChevronRight,
  Smartphone,
  Bookmark,
} from "lucide-react"
import { joinTemplate, requestWalletPass } from "@/server/onboarding-actions"
import type { OrganizationPublicInfo, OnboardingResult, JoinResult } from "@/server/onboarding-actions"
import type { PublicTemplateInfo } from "@/types/pass-instance"
import { computeTextColor } from "@/lib/wallet/card-design"
import { TemplateCardPreview } from "@/components/template-card-preview"
import { Card } from "@/components/ui/card"

// Convenience helpers to extract config fields from PublicTemplateInfo
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

type Platform = "apple" | "google"
type Step = "program-select" | "form" | "card-view" | "success"

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "apple"
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod|macintosh/.test(ua) && "ontouchend" in document) {
    return "apple"
  }
  if (/android/.test(ua)) {
    return "google"
  }
  // Desktop fallback — show both but default to Apple
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
  const programs = organization.templates
  const hasMultiplePrograms = programs.length > 1

  // Resolve preselected template (must match a valid program)
  const preselected = preselectedTemplateId
    ? programs.find((p) => p.id === preselectedTemplateId) ?? null
    : null

  // Auto-select if only one program OR if a valid preselectedTemplateId was provided
  const [selectedProgram, setSelectedProgram] = useState<PublicTemplateInfo | null>(
    preselected ?? (hasMultiplePrograms ? null : programs[0] ?? null)
  )
  const [step, setStep] = useState<Step>(
    preselected || !hasMultiplePrograms ? "form" : "program-select"
  )
  const [platform, setPlatform] = useState<Platform>("apple")
  const [showBothPlatforms, setShowBothPlatforms] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isRequestingPass, startPassTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [joinResult, setJoinResult] = useState<JoinResult | null>(null)
  const [walletResult, setWalletResult] = useState<OnboardingResult | null>(null)
  const [name, setName] = useState("")
  const [addedToWallet, setAddedToWallet] = useState(false)

  useEffect(() => {
    const detected = detectPlatform()
    setPlatform(detected)
    // On desktop, show both platform buttons
    if (!isIOS() && !isAndroid()) {
      setShowBothPlatforms(true)
    }
  }, [])

  function handleProgramSelect(program: PublicTemplateInfo) {
    setSelectedProgram(program)
    setStep("form")
  }

  function handleSubmit(formData: FormData) {
    setError(null)
    formData.set("organizationSlug", organization.slug)
    if (selectedProgram) {
      formData.set("templateId", selectedProgram.id)
    }

    startTransition(async () => {
      const res = await joinTemplate(formData)

      if (!res.success) {
        setError(res.error ?? "Something went wrong")
        return
      }

      setJoinResult(res)
      setStep("card-view")
    })
  }

  function handleAddToWallet(chosenPlatform: Platform) {
    if (!joinResult?.passInstanceId) return
    setError(null)

    startPassTransition(async () => {
      const res = await requestWalletPass(
        joinResult.passInstanceId!,
        organization.slug,
        chosenPlatform
      )

      if (!res.success) {
        setError(res.error ?? "Failed to generate wallet pass")
        return
      }

      setWalletResult(res)
      setAddedToWallet(true)

      if (res.platform === "apple" && res.passBuffer) {
        // Trigger .pkpass download
        const bytes = Uint8Array.from(atob(res.passBuffer), (c) =>
          c.charCodeAt(0)
        )
        const blob = new Blob([bytes], {
          type: "application/vnd.apple.pkpass",
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "loyalty-card.pkpass"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else if (res.platform === "google" && res.saveUrl) {
        // Redirect to Google Wallet save URL
        window.location.href = res.saveUrl
        return // Don't transition — page is navigating away
      }

      setStep("success")
    })
  }

  function handleContinueWithoutWallet() {
    setStep("success")
  }

  // Use selected program's card design, falling back to first program or organization defaults
  const activeProgram = selectedProgram ?? programs[0]
  const design = activeProgram?.passDesign
  const brandColor = design?.primaryColor ?? organization.brandColor ?? "oklch(0.55 0.2 265)"
  const textOnBrand = design?.textColor ?? computeTextColor(
    /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#4F46E5"
  )

  // Detect dark brand colors so badge stays visible
  const isColorDark = (() => {
    const m = brandColor.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/)
    if (!m) return false
    const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    // Perceived brightness (ITU-R BT.601)
    return (r * 299 + g * 587 + b * 114) / 1000 < 60
  })()
  const badgeMix = isColorDark ? 20 : 12

  const fontFamilyCss: Record<string, string> = {
    SANS: "inherit",
    SERIF: "Georgia, Cambria, 'Times New Roman', serif",
    ROUNDED: "'SF Pro Rounded', system-ui, sans-serif",
    MONO: "var(--font-geist-mono), 'Courier New', monospace",
  }
  const webFont = fontFamilyCss[design?.fontFamily ?? "SANS"] ?? "inherit"

  // --- Success screen ---
  if (step === "success") {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md text-center space-y-6">
          {/* Success checkmark */}
          <div
            className="mx-auto w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: brandColor,
              animation: "scale-in 0.5s ease-out",
            }}
          >
            <Check className="w-10 h-10 text-white" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {joinResult?.isReturning ? "Welcome back!" : "You're all set!"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {addedToWallet
                ? joinResult?.isReturning
                  ? `Welcome back, ${joinResult.contactName}! Your loyalty card has been re-issued.`
                  : `Your loyalty card for ${organization.name} is ready.`
                : `Your loyalty card for ${organization.name} has been created.`}
            </p>
          </div>

          {addedToWallet && walletResult?.platform === "apple" && (
            <p className="text-sm text-muted-foreground">
              Your pass should open automatically. Check your Wallet app if it
              doesn't appear.
            </p>
          )}
          {addedToWallet && walletResult?.platform === "google" && (
            <p className="text-sm text-muted-foreground">
              You're being redirected to Google Wallet. If nothing happens,{" "}
              <a
                href={walletResult.saveUrl}
                className="underline underline-offset-4 hover:text-foreground"
              >
                tap here
              </a>
              .
            </p>
          )}
          {!addedToWallet && (
            <p className="text-sm text-muted-foreground">
              Show your name at the counter to earn stamps on each visit.
            </p>
          )}

          {joinResult?.cardUrl && (
            <a
              href={joinResult.cardUrl}
              className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-input text-sm font-medium hover:bg-accent/50 transition-colors"
            >
              <Bookmark className="w-4 h-4" aria-hidden="true" />
              View your card
            </a>
          )}

          <button
            onClick={() => {
              setStep(hasMultiplePrograms ? "program-select" : "form")
              setJoinResult(null)
              setWalletResult(null)
              setAddedToWallet(false)
              setError(null)
              if (hasMultiplePrograms) {
                setSelectedProgram(null)
              }
            }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Start over
          </button>
        </div>
      </div>
    )
  }

  // --- Card view screen (post-enrollment, pre-wallet) ---
  if (step === "card-view" && joinResult) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4 bg-background" style={{ fontFamily: webFont }}>
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {joinResult.isReturning ? "Welcome back!" : "Your card is ready!"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {joinResult.isReturning
                ? `Welcome back, ${joinResult.contactName}!`
                : `${joinResult.contactName}, here's your loyalty card for ${organization.name}.`}
            </p>
          </div>

          {/* Full-size card preview */}
          {activeProgram && (
            <div className="flex justify-center">
              <TemplateCardPreview
                template={activeProgram}
                organizationName={organization.name}
                logoUrl={organization.logo}
                logoAppleUrl={organization.logoApple}
                customerName={joinResult.contactName}
                currentVisits={joinResult.currentCycleVisits ?? 0}
                hasReward={joinResult.hasAvailableReward}
              />
            </div>
          )}

          {/* Wallet buttons */}
          <div className="space-y-3">
            {/* Error */}
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Show platform-specific or both wallet buttons */}
            {isRequestingPass ? (
              <div className="flex items-center justify-center h-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-hidden="true" />
                <span className="ml-2 text-sm text-muted-foreground">Adding to wallet...</span>
              </div>
            ) : showBothPlatforms ? (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleAddToWallet("apple")}
                  disabled={isRequestingPass}
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
                  onClick={() => handleAddToWallet("google")}
                  disabled={isRequestingPass}
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
              <div className="flex justify-center">
                <button
                  onClick={() => handleAddToWallet(platform)}
                  disabled={isRequestingPass}
                  className="transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
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
              </div>
            )}

            {/* Continue without wallet */}
            <button
              onClick={handleContinueWithoutWallet}
              disabled={isRequestingPass}
              className="flex w-full items-center justify-center gap-2 h-10 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Continue without wallet
            </button>
          </div>

          {/* Bookmark hint */}
          {joinResult.cardUrl && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
              <a
                href={joinResult.cardUrl}
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Bookmark your card
              </a>
              {" "}to access it anytime
            </div>
          )}

          {/* Footer */}
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground/70">
              Powered by{" "}
              <span className="font-medium text-muted-foreground">Loyalshy</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // --- Program selection screen (multi-program only) ---
  if (step === "program-select") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            {organization.logo && (
              <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden bg-muted">
                <Image
                  src={organization.logo}
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
                Choose a loyalty program to join
              </p>
            </div>
          </div>

          {/* Program cards */}
          <div className="space-y-3">
            {programs.map((program) => {
              return (
                <Card asChild key={program.id}>
                <button
                  onClick={() => handleProgramSelect(program)}
                  className="w-full text-left p-4 hover:bg-accent/50 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4">
                    {/* Card preview thumbnail */}
                    <div className="shrink-0 rounded-lg overflow-hidden" style={{ width: 56, height: 72 }}>
                      <TemplateCardPreview
                        template={program}
                        organizationName={organization.name}
                        logoUrl={organization.logo}
                logoAppleUrl={organization.logoApple}
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
                        {program.passType === "COUPON"
                          ? getRewardDescription(program)
                          : program.passType === "MEMBERSHIP"
                            ? `${getRewardDescription(program)}`
                            : `${getRewardDescription(program)} after ${getVisitsRequired(program)} visits`}
                      </p>
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  </div>
                </button>
                </Card>
              )
            })}
          </div>

          {/* Footer */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
              Free digital loyalty card
            </div>
            <p className="text-[11px] text-muted-foreground/70">
              Powered by{" "}
              <span className="font-medium text-muted-foreground">Loyalshy</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // --- Form screen ---
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 bg-background" style={{ fontFamily: webFont }}>
      <div className="w-full max-w-md space-y-8">
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
            Choose a different program
          </button>
        )}

        {/* Header */}
        <div className="text-center space-y-4">
          {organization.logo && (
            <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden bg-muted">
              <Image
                src={organization.logo}
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
              {activeProgram?.name ?? "Get your digital loyalty card"}
            </p>
          </div>

          {/* Reward info */}
          {activeProgram && (
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{
                backgroundColor: `color-mix(in oklch, ${brandColor} ${badgeMix}%, transparent)`,
                color: brandColor,
              }}
            >
              <Gift className="w-4 h-4" aria-hidden="true" />
              {getRewardDescription(activeProgram)} after{" "}
              {getVisitsRequired(activeProgram)} visits
            </div>
          )}
        </div>

        {/* Custom message */}
        {design?.customMessage && (
          <div className="rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {design.customMessage}
            </p>
          </div>
        )}

        {/* Card preview */}
        {activeProgram && (
          <div className="flex justify-center">
            <TemplateCardPreview
              template={activeProgram}
              organizationName={organization.name}
              logoUrl={organization.logo}
              logoAppleUrl={organization.logoApple}
              compact
              customerName={name.trim() || undefined}
              currentVisits={0}
            />
          </div>
        )}

        {/* Form */}
        <form action={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="fullName"
              className="text-[13px] font-medium text-foreground"
            >
              Your name <span className="text-destructive">*</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              autoComplete="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-foreground/30 transition-colors"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-[13px] font-medium text-foreground"
            >
              Email{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="john@example.com"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-foreground/30 transition-colors"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label
              htmlFor="phone"
              className="text-[13px] font-medium text-foreground"
            >
              Phone{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 (555) 123-4567"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-foreground/30 transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 h-12 rounded-lg text-[15px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: brandColor,
              color: textOnBrand,
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                Creating your card...
              </>
            ) : (
              <>
                <Smartphone className="w-5 h-5" aria-hidden="true" />
                Get your card
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
            Free digital loyalty card
          </div>
          <p className="text-[11px] text-muted-foreground/70">
            Powered by{" "}
            <span className="font-medium text-muted-foreground">Loyalshy</span>
          </p>
        </div>
      </div>
    </div>
  )
}

