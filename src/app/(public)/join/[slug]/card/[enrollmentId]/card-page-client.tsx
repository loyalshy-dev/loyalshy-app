"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Loader2, Bookmark, CheckCircle2, Gift } from "lucide-react"
import { useTranslations } from "next-intl"
import { requestWalletPass, revealPrize } from "@/server/onboarding-actions"
import type { PassInstanceCardData } from "@/server/onboarding-actions"
import { computeTextColor } from "@/lib/wallet/card-design"
import { buildWalletPassDesign } from "@/lib/wallet/build-wallet-pass-design"
import { WalletPassRenderer } from "@/components/wallet-pass-renderer"
import { MinigameStep } from "@/components/minigames"
import { parseCouponConfig, formatCouponValue, parseMembershipConfig } from "@/lib/pass-config"

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
  data: PassInstanceCardData
  passInstanceId: string
  organizationSlug: string
  signature: string
}

export function CardPageClient({ data, passInstanceId, organizationSlug, signature }: CardPageClientProps) {
  const t = useTranslations("join.card")
  const [platform, setPlatform] = useState<Platform>("apple")
  const [showBothPlatforms, setShowBothPlatforms] = useState(false)
  const [isRequestingPass, startPassTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const showMinigame = !!data.unrevealedReward && !!data.minigameConfig?.enabled && !revealed

  const handleMinigameComplete = useCallback(() => {
    if (!data.unrevealedReward) return
    // Call revealPrize server action (fire-and-forget for UX, errors are non-critical)
    revealPrize(data.unrevealedReward.rewardId, passInstanceId, signature).catch(() => {})
    setRevealed(true)
  }, [data.unrevealedReward, passInstanceId, signature])

  useEffect(() => {
    const detected = detectPlatform()
    setPlatform(detected)
    if (!isIOS() && !isAndroid()) {
      setShowBothPlatforms(true)
    }
  }, [])

  const brandColor = data.template.passDesign?.primaryColor ?? data.organization.brandColor ?? "oklch(0.55 0.2 265)"
  const textOnBrand = data.template.passDesign?.textColor ?? computeTextColor(
    /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#4F46E5"
  )
  const passDesign = buildWalletPassDesign(data.template.passDesign)

  // Coupon-specific props
  const couponConfig = data.template.passType === "COUPON" ? parseCouponConfig(data.template.config) : null
  const isRedeemed = data.template.passType === "COUPON" && data.passInstanceStatus === "COMPLETED"
  const discountText = couponConfig
    ? couponConfig.discountType === "freebie"
      ? (isRedeemed ? `${couponConfig.couponDescription || "Free item"} (Redeemed)` : (couponConfig.couponDescription || "Free item"))
      : (isRedeemed ? `${formatCouponValue(couponConfig)} (Redeemed)` : formatCouponValue(couponConfig))
    : undefined
  const discountLabel = couponConfig?.discountType === "freebie" ? "OFFER" : undefined
  const couponCode = couponConfig?.couponCode ?? undefined
  const validUntil = couponConfig?.validUntil
    ? new Date(couponConfig.validUntil).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : undefined

  // Membership-specific props
  const membershipConfig = data.template.passType === "MEMBERSHIP" ? parseMembershipConfig(data.template.config) : null
  const tierName = membershipConfig?.membershipTier ?? undefined
  const benefits = membershipConfig?.benefits ?? undefined

  // Holder photo — per-instance, supported by MEMBERSHIP
  const holderPhotoUrl = data.holderPhotoUrl ?? undefined

  function handleAddToWallet(chosenPlatform: Platform) {
    setError(null)

    startPassTransition(async () => {
      const res = await requestWalletPass(passInstanceId, organizationSlug, chosenPlatform)

      if (!res.success) {
        setError(res.error ?? t("walletFailed"))
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
        a.download = `${organizationSlug}-pass.pkpass`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else if (res.platform === "google" && res.saveUrl) {
        window.location.href = res.saveUrl
      }
    })
  }

  if (showMinigame) {
    return (
      <div
      className="min-h-dvh flex flex-col items-center justify-center p-4"
      style={{
        background: `linear-gradient(to bottom, color-mix(in oklch, ${brandColor} 6%, var(--background)) 0%, var(--background) 60%)`,
      }}
    >
        <div className="w-full max-w-md space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              {t("rewardEarned")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {data.organization.name} — {data.template.name}
            </p>
          </div>
          <MinigameStep
            gameType={data.minigameConfig!.gameType}
            rewardText={data.unrevealedReward!.description}
            passInstanceId={passInstanceId}
            prizes={data.minigameConfig?.prizes?.map((p) => p.name)}
            primaryColor={data.minigameConfig?.primaryColor}
            accentColor={data.minigameConfig?.accentColor}
            onComplete={handleMinigameComplete}
            onSkip={handleMinigameComplete}
          />
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

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center p-4"
      style={{
        background: `linear-gradient(to bottom, color-mix(in oklch, ${brandColor} 6%, var(--background)) 0%, var(--background) 60%)`,
      }}
    >
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {t("title", { name: data.contactName })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {data.organization.name} — {data.template.name}
          </p>
        </div>

        {/* Reward earned banner */}
        {data.hasAvailableReward && data.earnedRewardDescription && !isRedeemed && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm font-medium text-success">
            <Gift className="size-4" />
            {data.earnedRewardDescription}
          </div>
        )}

        {/* Redeemed banner */}
        {isRedeemed && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" />
            {t("couponRedeemed")}
          </div>
        )}

        {/* Card */}
        <div className="flex justify-center">
          <WalletPassRenderer
            design={passDesign}
            format={platform}
            organizationName={data.organization.name}
            logoUrl={data.template.passDesign?.logoUrl ?? data.organization.logo}
            logoAppleUrl={data.template.passDesign?.logoAppleUrl}
            logoGoogleUrl={data.template.passDesign?.logoGoogleUrl}
            programName={data.template.name}
            customerName={data.contactName}
            currentVisits={data.currentCycleVisits}
            totalVisits={data.template.visitsRequired}
            rewardDescription={data.earnedRewardDescription ?? data.template.rewardDescription}
            hasReward={data.hasAvailableReward}
            qrValue={data.walletPassId ?? undefined}
            discountText={discountText}
            discountLabel={discountLabel}
            couponCode={couponCode}
            validUntil={validUntil}
            tierName={tierName}
            benefits={benefits}
            memberNumber={data.memberNumber != null ? `${data.memberNumber}` : "—"}
            showHolderPhoto={membershipConfig?.showHolderPhoto}
            holderPhotoPosition={membershipConfig?.holderPhotoPosition}
            holderPhotoUrl={holderPhotoUrl}
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
              {t("passAdded")}
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
                    {t("appleWallet")}
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
                    {t("googleWallet")}
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
                  {t("addingToWallet")}
                </>
              ) : (
                <>
                  {platform === "apple" ? (
                    <AppleIcon className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <GoogleWalletIcon className="w-5 h-5" aria-hidden="true" />
                  )}
                  {t("addToWallet", { platform: platform === "apple" ? "Apple" : "Google" })}
                </>
              )}
            </button>
          )}
        </div>

        {/* Bookmark hint */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
          {t("bookmarkHint")}
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
