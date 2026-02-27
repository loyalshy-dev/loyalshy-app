"use client"

import { useState, useEffect, useTransition } from "react"
import Image from "next/image"
import {
  Smartphone,
  CreditCard,
  Check,
  Loader2,
  ArrowLeft,
  Gift,
  ChevronRight,
} from "lucide-react"
import { joinLoyaltyProgram } from "@/server/onboarding-actions"
import type { RestaurantPublicInfo, OnboardingResult } from "@/server/onboarding-actions"
import type { PublicProgramInfo } from "@/types/enrollment"
import { computeTextColor } from "@/lib/wallet/card-design"

type Platform = "apple" | "google"
type Step = "program-select" | "form" | "success"

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
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<OnboardingResult | null>(null)

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
    formData.set("platform", platform)
    if (selectedProgram) {
      formData.set("programId", selectedProgram.id)
    }

    startTransition(async () => {
      const res = await joinLoyaltyProgram(formData)

      if (!res.success) {
        setError(res.error ?? "Something went wrong")
        return
      }

      setResult(res)

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
      }

      setStep("success")
    })
  }

  // Use selected program's card design, falling back to first program or restaurant defaults
  const activeProgram = selectedProgram ?? programs[0]
  const design = activeProgram?.cardDesign
  const shape = design?.shape ?? "CLEAN"
  const brandColor = design?.primaryColor ?? restaurant.brandColor ?? "oklch(0.55 0.2 265)"
  const textOnBrand = design?.textColor ?? computeTextColor(
    /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#4F46E5"
  )

  const fontFamilyCss: Record<string, string> = {
    SANS: "inherit",
    SERIF: "Georgia, Cambria, 'Times New Roman', serif",
    ROUNDED: "'SF Pro Rounded', system-ui, sans-serif",
    MONO: "var(--font-geist-mono), 'Courier New', monospace",
  }
  const webFont = fontFamilyCss[design?.fontFamily ?? "SANS"] ?? "inherit"

  // --- Success screen ---
  if (step === "success" && result) {
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
              {result.isReturning ? "Welcome back!" : "You're all set!"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {result.isReturning
                ? `Welcome back, ${result.customerName}! Your loyalty card has been re-issued.`
                : `Your loyalty card for ${restaurant.name} is ready.`}
            </p>
          </div>

          {result.platform === "apple" && (
            <p className="text-sm text-muted-foreground">
              Your pass should open automatically. Check your Wallet app if it
              doesn't appear.
            </p>
          )}
          {result.platform === "google" && (
            <p className="text-sm text-muted-foreground">
              You're being redirected to Google Wallet. If nothing happens,{" "}
              <a
                href={result.saveUrl}
                className="underline underline-offset-4 hover:text-foreground"
              >
                tap here
              </a>
              .
            </p>
          )}

          <button
            onClick={() => {
              setStep(hasMultiplePrograms ? "program-select" : "form")
              setResult(null)
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
              const pDesign = program.cardDesign
              const pColor = pDesign?.primaryColor ?? restaurant.brandColor ?? "oklch(0.55 0.2 265)"

              return (
                <button
                  key={program.id}
                  onClick={() => handleProgramSelect(program)}
                  className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-foreground/30 hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    {/* Color swatch */}
                    <div
                      className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: pColor }}
                    >
                      <Gift className="w-6 h-6 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate">
                        {program.name}
                      </h3>
                      <p className="text-[13px] text-muted-foreground mt-0.5">
                        {program.rewardDescription} after {program.visitsRequired} visits
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
              <CreditCard className="w-3.5 h-3.5" />
              Free digital loyalty card
            </div>
            <p className="text-[11px] text-muted-foreground/70">
              Powered by{" "}
              <span className="font-medium text-muted-foreground">Fidelio</span>
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

        {/* SHOWCASE: hero image header */}
        {shape === "SHOWCASE" && design?.stripImageUrl && (
          <div className="relative -mx-4 -mt-4 mb-4 h-[160px] overflow-hidden rounded-b-2xl">
            <Image
              src={design.stripImageUrl}
              alt={restaurant.name}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute bottom-4 left-4 flex items-center gap-3">
              {restaurant.logo && (
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10 border border-white/20">
                  <Image
                    src={restaurant.logo}
                    alt={restaurant.name}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div>
                <h1 className="text-xl font-semibold text-white tracking-tight">
                  {restaurant.name}
                </h1>
                <p className="text-white/70 text-sm">
                  {activeProgram?.name ?? "Get your digital loyalty card"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Standard header (CLEAN and INFO_RICH without hero) */}
        {shape !== "SHOWCASE" && (
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
                  backgroundColor: `color-mix(in oklch, ${brandColor} 12%, transparent)`,
                  color: brandColor,
                }}
              >
                <Gift className="w-4 h-4" />
                Earn a free {activeProgram.rewardDescription} after{" "}
                {activeProgram.visitsRequired} visits
              </div>
            )}
          </div>
        )}

        {/* SHOWCASE reward badge (below hero) */}
        {shape === "SHOWCASE" && activeProgram && (
          <div className="text-center">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{
                backgroundColor: `color-mix(in oklch, ${brandColor} 12%, transparent)`,
                color: brandColor,
              }}
            >
              <Gift className="w-4 h-4" />
              Earn a free {activeProgram.rewardDescription} after{" "}
              {activeProgram.visitsRequired} visits
            </div>
          </div>
        )}

        {/* INFO_RICH: custom message + extra details */}
        {shape === "INFO_RICH" && design?.customMessage && (
          <div className="rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {design.customMessage}
            </p>
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

          {/* Platform selector (visible on desktop) */}
          {showBothPlatforms && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">
                Choose your wallet
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPlatform("apple")}
                  className={`flex items-center justify-center gap-2 h-11 rounded-lg border text-sm font-medium transition-colors ${
                    platform === "apple"
                      ? "border-foreground bg-foreground text-background"
                      : "border-input hover:border-foreground/30"
                  }`}
                >
                  <AppleIcon className="w-4 h-4" />
                  Apple Wallet
                </button>
                <button
                  type="button"
                  onClick={() => setPlatform("google")}
                  className={`flex items-center justify-center gap-2 h-11 rounded-lg border text-sm font-medium transition-colors ${
                    platform === "google"
                      ? "border-foreground bg-foreground text-background"
                      : "border-input hover:border-foreground/30"
                  }`}
                >
                  <GoogleWalletIcon className="w-4 h-4" />
                  Google Wallet
                </button>
              </div>
            </div>
          )}

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
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating your card...
              </>
            ) : (
              <>
                {platform === "apple" ? (
                  <AppleIcon className="w-5 h-5" />
                ) : (
                  <GoogleWalletIcon className="w-5 h-5" />
                )}
                Add to {platform === "apple" ? "Apple" : "Google"} Wallet
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <CreditCard className="w-3.5 h-3.5" />
            Free digital loyalty card
          </div>
          <p className="text-[11px] text-muted-foreground/70">
            Powered by{" "}
            <span className="font-medium text-muted-foreground">Fidelio</span>
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
