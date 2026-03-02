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
import { joinProgram, requestWalletPass } from "@/server/onboarding-actions"
import type { RestaurantPublicInfo, OnboardingResult, JoinResult } from "@/server/onboarding-actions"
import type { PublicProgramInfo } from "@/types/enrollment"
import { computeTextColor } from "@/lib/wallet/card-design"
import { buildWalletPassDesign } from "@/lib/wallet/build-wallet-pass-design"
import { WalletPassRenderer } from "@/components/wallet-pass-renderer"
import { parseCouponConfig, parseMembershipConfig, formatCouponValue } from "@/lib/program-config"

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
  restaurant: RestaurantPublicInfo
  preselectedProgramId?: string
}

export function OnboardingForm({ restaurant, preselectedProgramId }: OnboardingFormProps) {
  const programs = restaurant.programs
  const hasMultiplePrograms = programs.length > 1

  // Resolve preselected program (must match a valid program)
  const preselected = preselectedProgramId
    ? programs.find((p) => p.id === preselectedProgramId) ?? null
    : null

  // Auto-select if only one program OR if a valid preselectedProgramId was provided
  const [selectedProgram, setSelectedProgram] = useState<PublicProgramInfo | null>(
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

  function handleProgramSelect(program: PublicProgramInfo) {
    setSelectedProgram(program)
    setStep("form")
  }

  function handleSubmit(formData: FormData) {
    setError(null)
    formData.set("restaurantSlug", restaurant.slug)
    if (selectedProgram) {
      formData.set("programId", selectedProgram.id)
    }

    startTransition(async () => {
      const res = await joinProgram(formData)

      if (!res.success) {
        setError(res.error ?? "Something went wrong")
        return
      }

      setJoinResult(res)
      setStep("card-view")
    })
  }

  function handleAddToWallet(chosenPlatform: Platform) {
    if (!joinResult?.enrollmentId) return
    setError(null)

    startPassTransition(async () => {
      const res = await requestWalletPass(
        joinResult.enrollmentId!,
        restaurant.slug,
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

  // Compute type-specific props for a program
  function getTypeProps(program: PublicProgramInfo) {
    if (program.programType === "COUPON") {
      const config = parseCouponConfig(program.cardDesign ? undefined : undefined) // config not on PublicProgramInfo yet
      return {
        discountText: program.rewardDescription,
        validUntil: "No expiry",
        couponCode: undefined as string | undefined,
      }
    }
    if (program.programType === "MEMBERSHIP") {
      return {
        tierName: program.rewardDescription,
        benefits: "Exclusive perks",
      }
    }
    return {}
  }

  // Use selected program's card design, falling back to first program or restaurant defaults
  const activeProgram = selectedProgram ?? programs[0]
  const design = activeProgram?.cardDesign
  const brandColor = design?.primaryColor ?? restaurant.brandColor ?? "oklch(0.55 0.2 265)"
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
                  ? `Welcome back, ${joinResult.customerName}! Your loyalty card has been re-issued.`
                  : `Your loyalty card for ${restaurant.name} is ready.`
                : `Your loyalty card for ${restaurant.name} has been created.`}
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
    const passDesign = activeProgram?.cardDesign
      ? buildWalletPassDesign(activeProgram.cardDesign)
      : null

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
                ? `Welcome back, ${joinResult.customerName}!`
                : `${joinResult.customerName}, here's your loyalty card for ${restaurant.name}.`}
            </p>
          </div>

          {/* Full-size card preview */}
          {passDesign && activeProgram && (
            <div className="flex justify-center">
              <WalletPassRenderer
                design={passDesign}
                format="apple"
                restaurantName={restaurant.name}
                logoUrl={restaurant.logo}
                programName={activeProgram.name}
                customerName={joinResult.customerName}
                currentVisits={joinResult.currentCycleVisits ?? 0}
                totalVisits={activeProgram.visitsRequired}
                rewardDescription={activeProgram.rewardDescription}
                hasReward={joinResult.hasAvailableReward}
                {...getTypeProps(activeProgram)}
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
            {showBothPlatforms ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAddToWallet("apple")}
                  disabled={isRequestingPass}
                  className="flex items-center justify-center gap-2 h-12 rounded-lg text-[15px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: brandColor,
                    color: textOnBrand,
                  }}
                >
                  {isRequestingPass ? (
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <>
                      <AppleIcon className="w-5 h-5" aria-hidden="true" />
                      Apple Wallet
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleAddToWallet("google")}
                  disabled={isRequestingPass}
                  className="flex items-center justify-center gap-2 h-12 rounded-lg text-[15px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: brandColor,
                    color: textOnBrand,
                  }}
                >
                  {isRequestingPass ? (
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <>
                      <GoogleWalletIcon className="w-5 h-5" aria-hidden="true" />
                      Google Wallet
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleAddToWallet(platform)}
                disabled={isRequestingPass}
                className="flex w-full items-center justify-center gap-2 h-12 rounded-lg text-[15px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: brandColor,
                  color: textOnBrand,
                }}
              >
                {isRequestingPass ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    Adding to wallet...
                  </>
                ) : (
                  <>
                    {platform === "apple" ? (
                      <AppleIcon className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <GoogleWalletIcon className="w-5 h-5" aria-hidden="true" />
                    )}
                    Add to {platform === "apple" ? "Apple" : "Google"} Wallet
                  </>
                )}
              </button>
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
            {restaurant.logo && (
              <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden bg-muted">
                <Image
                  src={restaurant.logo}
                  alt={restaurant.name}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {restaurant.name}
              </h1>
              <p className="text-muted-foreground text-[15px]">
                Choose a loyalty program to join
              </p>
            </div>
          </div>

          {/* Program cards */}
          <div className="space-y-3">
            {programs.map((program) => {
              const programDesign = buildWalletPassDesign(program.cardDesign)

              return (
                <button
                  key={program.id}
                  onClick={() => handleProgramSelect(program)}
                  className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-foreground/30 hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    {/* Card preview thumbnail */}
                    <div className="shrink-0 rounded-lg overflow-hidden" style={{ width: 56, height: 72 }}>
                      <WalletPassRenderer
                        design={programDesign}
                        format="apple"
                        compact
                        width={56}
                        height={72}
                        restaurantName={restaurant.name}
                        logoUrl={restaurant.logo}
                        programName={program.name}
                        currentVisits={0}
                        totalVisits={program.visitsRequired}
                        rewardDescription=""
                        {...getTypeProps(program)}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate">
                        {program.name}
                      </h3>
                      <p className="text-[13px] text-muted-foreground mt-0.5">
                        {program.programType === "COUPON"
                          ? program.rewardDescription
                          : program.programType === "MEMBERSHIP"
                            ? `${program.rewardDescription}`
                            : `${program.rewardDescription} after ${program.visitsRequired} visits`}
                      </p>
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                  </div>
                </button>
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
          {restaurant.logo && (
            <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden bg-muted">
              <Image
                src={restaurant.logo}
                alt={restaurant.name}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {restaurant.name}
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
              {activeProgram.rewardDescription} after{" "}
              {activeProgram.visitsRequired} visits
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
            {(() => {
              const formDesign = buildWalletPassDesign(activeProgram.cardDesign)
              return (
                <WalletPassRenderer
                  design={formDesign}
                  format="apple"
                  compact
                  restaurantName={restaurant.name}
                  logoUrl={restaurant.logo}
                  programName={activeProgram.name}
                  customerName={name.trim() || undefined}
                  currentVisits={0}
                  totalVisits={activeProgram.visitsRequired}
                  rewardDescription={activeProgram.rewardDescription}
                  {...getTypeProps(activeProgram)}
                />
              )
            })()}
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

// --- SVG Icons -----------------------------------------------

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

function GoogleWalletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M3 7c0-1.1.9-2 2-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm2 0v10h14V7H5zm2 2h10v2H7V9zm0 4h7v2H7v-2z" />
    </svg>
  )
}
