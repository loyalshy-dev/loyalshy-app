"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Pencil, Smartphone, CreditCard } from "lucide-react"
import { WalletPassRenderer, type WalletPassDesign } from "@/components/wallet-pass-renderer"
import { parseStampGridConfig, parseStripFilters } from "@/lib/wallet/card-design"
import { parseCouponConfig, parseMembershipConfig, formatCouponValue } from "@/lib/program-config"

type CardDesignPreviewProps = {
  programId: string
  programName: string
  programType: string
  programConfig: unknown
  restaurantName: string
  restaurantLogo: string | null
  restaurantLogoApple: string | null
  restaurantLogoGoogle: string | null
  visitsRequired: number
  rewardDescription: string
  cardDesign: {
    cardType: string
    shape: string
    primaryColor: string | null
    secondaryColor: string | null
    textColor: string | null
    patternStyle: string
    progressStyle: string
    labelFormat: string
    customProgressLabel: string | null
    stripImageUrl: string | null
    editorConfig?: unknown
  } | null
}

type PreviewFormat = "apple" | "google"

const FORMAT_TABS: { id: PreviewFormat; label: string; icon: React.ReactNode }[] = [
  { id: "apple", label: "Apple Wallet", icon: <Smartphone size={14} /> },
  { id: "google", label: "Google Wallet", icon: <CreditCard size={14} /> },
]

export function CardDesignPreview({
  programId,
  programName,
  programType,
  programConfig,
  restaurantName,
  restaurantLogo,
  restaurantLogoApple,
  restaurantLogoGoogle,
  visitsRequired,
  rewardDescription,
  cardDesign,
}: CardDesignPreviewProps) {
  const [format, setFormat] = useState<PreviewFormat>("apple")

  const sf = cardDesign ? parseStripFilters(cardDesign.editorConfig) : null
  const useStampGrid = sf ? (sf.useStampGrid || cardDesign?.patternStyle === "STAMP_GRID") : false

  const design: WalletPassDesign = {
    cardType: (cardDesign?.cardType ?? "STAMP") as WalletPassDesign["cardType"],
    shape: (cardDesign?.shape ?? "CLEAN") as WalletPassDesign["shape"],
    primaryColor: cardDesign?.primaryColor ?? "#1a1a2e",
    secondaryColor: cardDesign?.secondaryColor ?? "#ffffff",
    textColor: cardDesign?.textColor ?? "#ffffff",
    progressStyle: (cardDesign?.progressStyle ?? "NUMBERS") as WalletPassDesign["progressStyle"],
    labelFormat: (cardDesign?.labelFormat ?? "UPPERCASE") as WalletPassDesign["labelFormat"],
    customProgressLabel: cardDesign?.customProgressLabel ?? null,
    stripImageUrl: cardDesign?.stripImageUrl ?? null,
    stripOpacity: sf?.stripOpacity ?? 1,
    stripGrayscale: sf?.stripGrayscale ?? false,
    patternStyle: (cardDesign?.patternStyle === "STAMP_GRID" ? "NONE" : cardDesign?.patternStyle ?? "NONE") as WalletPassDesign["patternStyle"],
    useStampGrid,
    stripColor1: sf?.stripColor1 ?? null,
    stripColor2: sf?.stripColor2 ?? null,
    stripFill: sf?.stripFill ?? "gradient",
    patternColor: sf?.patternColor ?? null,
    stripImagePosition: sf?.stripImagePosition,
    stripImageZoom: sf?.stripImageZoom,
    stampGridConfig: useStampGrid && cardDesign
      ? parseStampGridConfig(cardDesign.editorConfig)
      : undefined,
  }

  // Type-specific preview props
  const couponConfig = useMemo(
    () => programType === "COUPON" ? parseCouponConfig(programConfig) : null,
    [programType, programConfig]
  )
  const membershipConfig = useMemo(
    () => programType === "MEMBERSHIP" ? parseMembershipConfig(programConfig) : null,
    [programType, programConfig]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Card Design</h2>
          <p className="text-[13px] text-muted-foreground">
            Preview your loyalty card across different platforms.
          </p>
        </div>
        <Link
          href={`/dashboard/programs/${programId}/studio`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Pencil size={14} />
          Open Studio
        </Link>
      </div>

      {/* Format tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {FORMAT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFormat(tab.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              format === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Card preview */}
      <div className="flex justify-center rounded-xl border border-border bg-muted/30 p-8">
        <div className="flex flex-col items-center gap-4">
          <WalletPassRenderer
            design={design}
            format={format}
            restaurantName={restaurantName}
            logoUrl={restaurantLogo}
            logoAppleUrl={restaurantLogoApple}
            logoGoogleUrl={restaurantLogoGoogle}
            programName={programName}
            currentVisits={programType === "STAMP_CARD" ? 4 : 0}
            totalVisits={visitsRequired}
            rewardDescription={rewardDescription}
            customerName="Jane D."
            // Coupon props
            discountText={couponConfig ? formatCouponValue(couponConfig) : undefined}
            couponCode={couponConfig?.couponCode}
            validUntil={couponConfig?.validUntil
              ? new Date(couponConfig.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : programType === "COUPON" ? "No expiry" : undefined}
            // Membership props
            tierName={membershipConfig?.membershipTier}
            benefits={membershipConfig?.benefits}
          />
          <p className="text-[11px] text-muted-foreground">
            {format === "apple" && "Apple Wallet pass preview"}
            {format === "google" && "Google Wallet pass preview"}
          </p>
        </div>
      </div>
    </div>
  )
}
