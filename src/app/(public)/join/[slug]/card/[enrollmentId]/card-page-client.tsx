"use client"

import { useState, useEffect, useTransition } from "react"
import { Loader2, Bookmark } from "lucide-react"
import { requestWalletPass } from "@/server/onboarding-actions"
import type { EnrollmentCardData } from "@/server/onboarding-actions"
import { computeTextColor } from "@/lib/wallet/card-design"
import { buildWalletPassDesign } from "@/lib/wallet/build-wallet-pass-design"
import { WalletPassRenderer } from "@/components/wallet-pass-renderer"

type Platform = "apple" | "google"

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "apple"
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod|macintosh/.test(ua) && "ontouchend" in document) {
    return "apple"
  }
  if (/android/.test(ua)) {
    return "google"
  }
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

type CardPageClientProps = {
  data: EnrollmentCardData
  enrollmentId: string
  restaurantSlug: string
}

export function CardPageClient({ data, enrollmentId, restaurantSlug }: CardPageClientProps) {
  const [platform, setPlatform] = useState<Platform>("apple")
  const [showBothPlatforms, setShowBothPlatforms] = useState(false)
  const [isRequestingPass, startPassTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const detected = detectPlatform()
    setPlatform(detected)
    if (!isIOS() && !isAndroid()) {
      setShowBothPlatforms(true)
    }
  }, [])

  const brandColor = data.program.cardDesign?.primaryColor ?? data.restaurant.brandColor ?? "oklch(0.55 0.2 265)"
  const textOnBrand = data.program.cardDesign?.textColor ?? computeTextColor(
    /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#4F46E5"
  )
  const passDesign = buildWalletPassDesign(data.program.cardDesign)

  function handleAddToWallet(chosenPlatform: Platform) {
    setError(null)

    startPassTransition(async () => {
      const res = await requestWalletPass(enrollmentId, restaurantSlug, chosenPlatform)

      if (!res.success) {
        setError(res.error ?? "Failed to generate wallet pass")
        return
      }

      setSuccess(true)

      if (res.platform === "apple" && res.passBuffer) {
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
        window.location.href = res.saveUrl
      }
    })
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {data.customerName}'s Card
          </h1>
          <p className="text-muted-foreground text-sm">
            {data.restaurant.name} — {data.program.name}
          </p>
        </div>

        {/* Card */}
        <div className="flex justify-center">
          <WalletPassRenderer
            design={passDesign}
            format="apple"
            restaurantName={data.restaurant.name}
            logoUrl={data.restaurant.logo}
            programName={data.program.name}
            customerName={data.customerName}
            currentVisits={data.currentCycleVisits}
            totalVisits={data.program.visitsRequired}
            rewardDescription={data.program.rewardDescription}
            hasReward={data.hasAvailableReward}
            qrValue={data.walletPassId ?? undefined}
          />
        </div>

        {/* Wallet buttons */}
        <div className="space-y-3">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {success ? (
            <p className="text-center text-sm text-muted-foreground">
              Pass added! Check your Wallet app.
            </p>
          ) : showBothPlatforms ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAddToWallet("apple")}
                disabled={isRequestingPass}
                className="flex items-center justify-center gap-2 h-12 rounded-lg text-[15px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: brandColor, color: textOnBrand }}
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
                style={{ backgroundColor: brandColor, color: textOnBrand }}
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
              style={{ backgroundColor: brandColor, color: textOnBrand }}
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
        </div>

        {/* Bookmark hint */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
          Bookmark this page to access your card anytime
        </div>

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
