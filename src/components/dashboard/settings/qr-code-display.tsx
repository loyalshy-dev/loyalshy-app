"use client"

import { useState, useRef } from "react"
import QRCode from "qrcode"
import {
  Download,
  QrCode,
  Smartphone,
} from "lucide-react"
import { TemplateCardPreview } from "@/components/template-card-preview"
import { StyledQrCode, renderStyledQr } from "@/components/styled-qr-code"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { parseCouponConfig, parseMembershipConfig, formatCouponValue } from "@/lib/pass-config"

type SizePreset = {
  id: string
  label: string
  description: string
  qrSize: number
  canvasWidth: number
  canvasHeight: number
}

const SIZE_PRESETS: SizePreset[] = [
  {
    id: "receipt",
    label: "Receipt",
    description: "3\" x 3\"",
    qrSize: 600,
    canvasWidth: 600,
    canvasHeight: 750,
  },
  {
    id: "table-tent",
    label: "Table Tent",
    description: "4\" x 6\"",
    qrSize: 800,
    canvasWidth: 800,
    canvasHeight: 1200,
  },
  {
    id: "poster",
    label: "Poster",
    description: "8.5\" x 11\"",
    qrSize: 1200,
    canvasWidth: 1700,
    canvasHeight: 2200,
  },
]

type PartialCardDesign = {
  cardType?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  textColor?: string | null
  showStrip?: boolean
  patternStyle?: string | null
  progressStyle?: string | null
  labelFormat?: string | null
  customProgressLabel?: string | null
  stripImageUrl?: string | null
  editorConfig?: unknown
  logoUrl?: string | null
  logoAppleUrl?: string | null
  logoGoogleUrl?: string | null
}

type TemplateInfo = {
  id: string
  name: string
  passType?: string
  templateConfig?: unknown
  rewardDescription: string
  visitsRequired: number
  cardDesign?: PartialCardDesign | null
}

type QrCodeDisplayProps = {
  organization: {
    name: string
    slug: string
    logo: string | null
    logoApple: string | null
    logoGoogle: string | null
    brandColor: string | null
  }
  templates: TemplateInfo[]
  joinUrl: string
}

export function QrCodeDisplay({
  organization,
  templates,
  joinUrl,
}: QrCodeDisplayProps) {
  const activeTemplate = templates[0] ?? null
  const rewardDescription = activeTemplate?.rewardDescription ?? "Free reward"
  const visitsRequired = activeTemplate?.visitsRequired ?? 10
  const activeTemplateDesign = activeTemplate?.cardDesign ?? null
  const activeTemplateType = activeTemplate?.passType
  const activeTemplateConfig = activeTemplate?.templateConfig
  const couponConfig = activeTemplateType === "COUPON" ? parseCouponConfig(activeTemplateConfig) : null
  const membershipConfig = activeTemplateType === "MEMBERSHIP" ? parseMembershipConfig(activeTemplateConfig) : null

  const previewTemplate = activeTemplate
    ? {
        name: activeTemplate.name,
        passType: activeTemplate.passType ?? "STAMP_CARD",
        config: activeTemplate.templateConfig,
        passDesign: activeTemplate.cardDesign ?? null,
      }
    : null

  // Resolve logo for QR center — prefer program Google logo > org Google logo > org general logo
  const qrLogoUrl =
    activeTemplateDesign?.logoGoogleUrl ??
    organization.logoGoogle ??
    activeTemplateDesign?.logoUrl ??
    organization.logo

  const accentColor =
    activeTemplateDesign?.primaryColor ??
    organization.brandColor ??
    "#1a1a2e"

  const [selectedSize, setSelectedSize] = useState<string>("table-tent")
  const [downloading, setDownloading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  async function downloadPng() {
    setDownloading(true)

    try {
      const preset = SIZE_PRESETS.find((p) => p.id === selectedSize) ?? SIZE_PRESETS[1]
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = preset.canvasWidth
      canvas.height = preset.canvasHeight

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const posterAccentColor =
        activeTemplateDesign?.primaryColor ?? organization.brandColor ?? "#1a1a2e"

      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barHeight = Math.round(canvas.height * 0.06)
      ctx.fillStyle = posterAccentColor
      ctx.fillRect(0, 0, canvas.width, barHeight)

      const nameFontSize = Math.round(canvas.width * 0.05)
      ctx.fillStyle = "#111111"
      ctx.font = `600 ${nameFontSize}px -apple-system, 'Segoe UI', sans-serif`
      ctx.textAlign = "center"
      ctx.fillText(
        organization.name,
        canvas.width / 2,
        barHeight + nameFontSize + Math.round(canvas.height * 0.03)
      )

      const qr = QRCode.create(joinUrl, { errorCorrectionLevel: "H" })
      // Render QR without image logo for canvas (external images taint canvas via SVG)
      const styledSvg = renderStyledQr(qr.modules, preset.qrSize, organization.name.charAt(0).toUpperCase(), { bg: posterAccentColor, fg: "#ffffff" })
      const svgBlob = new Blob([styledSvg], { type: "image/svg+xml" })
      const svgUrl = URL.createObjectURL(svgBlob)

      const qrImage = new window.Image()
      await new Promise<void>((resolve) => {
        qrImage.onload = () => resolve()
        qrImage.src = svgUrl
      })
      URL.revokeObjectURL(svgUrl)

      const qrDrawSize = Math.min(preset.qrSize, canvas.width * 0.75)
      const qrX = (canvas.width - qrDrawSize) / 2
      const qrY = barHeight + nameFontSize + Math.round(canvas.height * 0.06)
      ctx.drawImage(qrImage, qrX, qrY, qrDrawSize, qrDrawSize)

      // Draw logo image on top of QR center
      if (qrLogoUrl) {
        try {
          const logoImg = new window.Image()
          logoImg.crossOrigin = "anonymous"
          await new Promise<void>((resolve, reject) => {
            logoImg.onload = () => resolve()
            logoImg.onerror = () => reject()
            logoImg.src = qrLogoUrl
          })
          const logoSize = qrDrawSize * 0.18 * 2 // matches centerModules ratio
          const logoCenterX = qrX + qrDrawSize / 2
          const logoCenterY = qrY + qrDrawSize / 2
          const logoRadius = logoSize / 2

          // Draw circular clipped logo
          ctx.save()
          ctx.beginPath()
          ctx.arc(logoCenterX, logoCenterY, logoRadius + 2, 0, Math.PI * 2)
          ctx.fillStyle = posterAccentColor
          ctx.fill()
          ctx.beginPath()
          ctx.arc(logoCenterX, logoCenterY, logoRadius, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(logoImg, logoCenterX - logoRadius, logoCenterY - logoRadius, logoSize, logoSize)
          ctx.restore()
        } catch {
          // Logo failed to load — text fallback already rendered in SVG
        }
      }

      const subFontSize = Math.round(canvas.width * 0.035)
      ctx.fillStyle = "#666666"
      ctx.font = `500 ${subFontSize}px -apple-system, 'Segoe UI', sans-serif`
      const scanText = activeTemplate
        ? `Scan to join ${activeTemplate.name}`
        : "Scan to join our loyalty program"
      ctx.fillText(scanText, canvas.width / 2, qrY + qrDrawSize + Math.round(canvas.height * 0.04))

      const rewardFontSize = Math.round(canvas.width * 0.028)
      ctx.fillStyle = "#999999"
      ctx.font = `400 ${rewardFontSize}px -apple-system, 'Segoe UI', sans-serif`
      const rewardText = activeTemplateType === "COUPON" && couponConfig
        ? formatCouponValue(couponConfig)
        : activeTemplateType === "MEMBERSHIP" && membershipConfig
          ? `${membershipConfig.membershipTier} membership`
          : `Earn a free ${rewardDescription} after ${visitsRequired} visits`
      ctx.fillText(
        rewardText,
        canvas.width / 2,
        qrY + qrDrawSize + Math.round(canvas.height * 0.04) + rewardFontSize + Math.round(canvas.height * 0.015)
      )

      const brandFontSize = Math.round(canvas.width * 0.022)
      ctx.fillStyle = "#bbbbbb"
      ctx.font = `400 ${brandFontSize}px -apple-system, 'Segoe UI', sans-serif`
      ctx.fillText("Powered by Loyalshy", canvas.width / 2, canvas.height - Math.round(canvas.height * 0.03))

      const suffix = activeTemplate
        ? `${activeTemplate.name.toLowerCase().replace(/\s+/g, "-")}-${selectedSize}`
        : `qr-${selectedSize}`
      const link = document.createElement("a")
      link.download = `${organization.slug}-${suffix}.png`
      link.href = canvas.toDataURL("image/png", 1.0)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-brand/10">
          <QrCode className="size-3.5 text-brand" />
        </div>
        <h3 className="text-sm font-medium">QR code & print</h3>
      </div>

      <div className="space-y-5">
        {/* QR Preview */}
        <div className="flex justify-center">
          <div
            className="w-full max-w-xs rounded-2xl overflow-hidden shadow-md bg-card"
            style={{ borderTopColor: accentColor, borderTopWidth: 4 }}
          >
            <div className="h-2 w-full" style={{ backgroundColor: accentColor }} />

            <div className="flex flex-col items-center gap-4 px-5 py-5">
              {/* QR code */}
              <StyledQrCode
                value={joinUrl}
                size={176}
                logoText={organization.name.charAt(0).toUpperCase()}
                logoUrl={qrLogoUrl}
                bgColor={accentColor}
              />

              {/* Info */}
              <div className="text-center space-y-0.5">
                <h3 className="font-semibold text-[14px] text-foreground">{organization.name}</h3>
                {activeTemplate && (
                  <>
                    <p className="text-[12px] font-medium text-muted-foreground">{activeTemplate.name}</p>
                    <p className="text-[11px] text-muted-foreground/60">
                      {activeTemplateType === "COUPON" && couponConfig
                        ? formatCouponValue(couponConfig)
                        : activeTemplateType === "MEMBERSHIP" && membershipConfig
                          ? `${membershipConfig.membershipTier} membership`
                          : `${activeTemplate.rewardDescription} after ${activeTemplate.visitsRequired} visits`}
                    </p>
                  </>
                )}
              </div>

              {/* Card preview */}
              {previewTemplate && (
                <div className="w-full flex justify-center">
                  <TemplateCardPreview
                    template={previewTemplate}
                    organizationName={organization.name}
                    logoUrl={organization.logo}
                    logoAppleUrl={organization.logoApple}
                    logoGoogleUrl={organization.logoGoogle}
                    compact
                    width={180}
                    height={250}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Download controls */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-muted-foreground">
              Print size
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedSize(preset.id)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    selectedSize === preset.id
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <span className="font-medium">{preset.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={downloadPng}
            disabled={downloading}
            className="w-full gap-2"
          >
            <Download className="size-4" />
            {downloading ? "Generating..." : "Download PNG"}
          </Button>

          {/* NFC note */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Smartphone className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[12px] text-muted-foreground">
              You can also program NFC tags with this URL. Customers tap the tag to join instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Hidden canvas for PNG export */}
      <canvas ref={canvasRef} className="hidden" />
    </Card>
  )
}
