"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import QRCode from "qrcode"
import {
  Download,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Smartphone,
  LayoutGrid,
} from "lucide-react"
import { TemplateCardPreview } from "@/components/template-card-preview"
import { Card } from "@/components/ui/card"
import { parseCouponConfig, parseMembershipConfig, formatCouponValue } from "@/lib/pass-config"

type SizePreset = {
  id: string
  label: string
  description: string
  qrSize: number // px for the QR code on the canvas
  canvasWidth: number
  canvasHeight: number
}

const SIZE_PRESETS: SizePreset[] = [
  {
    id: "receipt",
    label: "Receipt",
    description: "3\" x 3\" — for receipts",
    qrSize: 600,
    canvasWidth: 600,
    canvasHeight: 750,
  },
  {
    id: "table-tent",
    label: "Table Tent",
    description: "4\" x 6\" — for table tents",
    qrSize: 800,
    canvasWidth: 800,
    canvasHeight: 1200,
  },
  {
    id: "poster",
    label: "Poster",
    description: "8.5\" x 11\" — for posters",
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
    brandColor: string | null
  }
  templates: TemplateInfo[]
}

export function QrCodeDisplay({
  organization,
  templates,
}: QrCodeDisplayProps) {
  const hasMultipleTemplates = templates.length > 1

  // "all" = generic join URL (picker), or a program id for deep-link
  const [activeTab, setActiveTab] = useState<string>(
    hasMultipleTemplates ? "all" : templates[0]?.id ?? "all"
  )
  const [qrSvg, setQrSvg] = useState<string>("")
  const [selectedSize, setSelectedSize] = useState<string>("table-tent")
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const activeTemplate = templates.find((p) => p.id === activeTab) ?? null
  const rewardDescription = activeTemplate?.rewardDescription ?? templates[0]?.rewardDescription ?? "Free reward"
  const visitsRequired = activeTemplate?.visitsRequired ?? templates[0]?.visitsRequired ?? 10

  // Derive card design data for the active program (or first program as fallback)
  const activeTemplateDesign = activeTemplate?.cardDesign ?? templates[0]?.cardDesign ?? null

  // Type-specific preview data (for poster text only)
  const activeTemplateType = activeTemplate?.passType ?? templates[0]?.passType
  const activeTemplateConfig = activeTemplate?.templateConfig ?? templates[0]?.templateConfig
  const couponConfig = activeTemplateType === "COUPON" ? parseCouponConfig(activeTemplateConfig) : null
  const membershipConfig = activeTemplateType === "MEMBERSHIP" ? parseMembershipConfig(activeTemplateConfig) : null

  // Build a CardPreviewTemplate from the active template
  const previewTemplate = activeTemplate
    ? {
        name: activeTemplate.name,
        passType: activeTemplate.passType ?? "STAMP_CARD",
        config: activeTemplate.templateConfig,
        passDesign: activeTemplate.cardDesign ?? null,
      }
    : templates[0]
      ? {
          name: templates[0].name,
          passType: templates[0].passType ?? "STAMP_CARD",
          config: templates[0].templateConfig,
          passDesign: templates[0].cardDesign ?? null,
        }
      : null

  // Pull resolved primary color for the poster accent bar
  const accentColor =
    activeTemplateDesign?.primaryColor ??
    organization.brandColor ??
    "#1a1a2e"

  const origin = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? ""

  const templateId = activeTab === "all" ? null : activeTab
  const joinPath = templateId
    ? `/join/${organization.slug}?program=${templateId}`
    : `/join/${organization.slug}`
  const joinUrl = origin ? `${origin}${joinPath}` : joinPath

  const generateQrSvg = useCallback(async () => {
    const svg = await QRCode.toString(joinUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
    setQrSvg(svg)
  }, [joinUrl])

  useEffect(() => {
    generateQrSvg()
  }, [generateQrSvg])

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(joinUrl)
    } catch {
      // Fallback for insecure contexts (HTTP)
      const textarea = document.createElement("textarea")
      textarea.value = joinUrl
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

      // Background
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Brand color bar at top (uses card design primary or organization brand color)
      const barHeight = Math.round(canvas.height * 0.06)
      ctx.fillStyle = posterAccentColor
      ctx.fillRect(0, 0, canvas.width, barHeight)

      // Organization name
      const nameFontSize = Math.round(canvas.width * 0.05)
      ctx.fillStyle = "#111111"
      ctx.font = `600 ${nameFontSize}px -apple-system, 'Segoe UI', sans-serif`
      ctx.textAlign = "center"
      ctx.fillText(
        organization.name,
        canvas.width / 2,
        barHeight + nameFontSize + Math.round(canvas.height * 0.03)
      )

      // QR code
      const qrDataUrl = await QRCode.toDataURL(joinUrl, {
        width: preset.qrSize,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      })

      const qrImage = new window.Image()
      await new Promise<void>((resolve) => {
        qrImage.onload = () => resolve()
        qrImage.src = qrDataUrl
      })

      const qrDrawSize = Math.min(
        preset.qrSize,
        canvas.width * 0.75
      )
      const qrX = (canvas.width - qrDrawSize) / 2
      const qrY =
        barHeight +
        nameFontSize +
        Math.round(canvas.height * 0.06)
      ctx.drawImage(qrImage, qrX, qrY, qrDrawSize, qrDrawSize)

      // "Scan to join" text
      const subFontSize = Math.round(canvas.width * 0.035)
      ctx.fillStyle = "#666666"
      ctx.font = `500 ${subFontSize}px -apple-system, 'Segoe UI', sans-serif`
      const scanText = activeTemplate
        ? `Scan to join ${activeTemplate.name}`
        : "Scan to join our loyalty program"
      ctx.fillText(
        scanText,
        canvas.width / 2,
        qrY + qrDrawSize + Math.round(canvas.height * 0.04)
      )

      // Reward info
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
        qrY +
          qrDrawSize +
          Math.round(canvas.height * 0.04) +
          rewardFontSize +
          Math.round(canvas.height * 0.015)
      )

      // Loyalshy branding at bottom
      const brandFontSize = Math.round(canvas.width * 0.022)
      ctx.fillStyle = "#bbbbbb"
      ctx.font = `400 ${brandFontSize}px -apple-system, 'Segoe UI', sans-serif`
      ctx.fillText(
        "Powered by Loyalshy",
        canvas.width / 2,
        canvas.height - Math.round(canvas.height * 0.03)
      )

      // Download
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
    <div className="space-y-6">
      {/* Template tabs — only shown when multiple templates exist */}
      {hasMultipleTemplates && (
        <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            All Programs
          </button>
          {templates.map((program) => (
            <button
              key={program.id}
              onClick={() => setActiveTab(program.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors truncate ${
                activeTab === program.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {program.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* QR Code preview */}
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col items-center space-y-6">
            {/* Poster mockup: accent bar + QR code + info */}
            <div
              className="w-full max-w-xs rounded-2xl overflow-hidden shadow-md bg-card"
              style={{ borderTopColor: accentColor, borderTopWidth: 4 }}
            >
              {/* Colored accent strip */}
              <div
                className="h-2 w-full"
                style={{ backgroundColor: accentColor }}
              />

              <div className="flex flex-col items-center gap-4 px-5 py-5">
                {/* QR code */}
                <div className="relative">
                  <div
                    className="w-44 h-44 rounded-xl bg-background p-3 shadow-sm border border-border"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                  {/* Organization logo overlay in center */}
                  {organization.logo && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-background border-2 border-background shadow-sm">
                        <Image
                          src={organization.logo}
                          alt=""
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Organization / template info */}
                <div className="text-center space-y-0.5">
                  <h3 className="font-semibold text-[14px] text-foreground">{organization.name}</h3>
                  {activeTemplate ? (
                    <>
                      <p className="text-[12px] font-medium text-muted-foreground">{activeTemplate.name}</p>
                      <p className="text-[11px] text-muted-foreground/60">
                        {activeTemplate.passType === "COUPON" && couponConfig
                          ? formatCouponValue(couponConfig)
                          : activeTemplate.passType === "MEMBERSHIP" && membershipConfig
                            ? `${membershipConfig.membershipTier} membership`
                            : `${activeTemplate.rewardDescription} after ${activeTemplate.visitsRequired} visits`}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/60">
                      Choose from {templates.length} programs
                    </p>
                  )}
                </div>

                {/* Card preview */}
                {previewTemplate && (
                  <div className="w-full flex justify-center">
                    <TemplateCardPreview
                      template={previewTemplate}
                      organizationName={organization.name}
                      logoUrl={organization.logoApple ?? organization.logo}
                      compact
                      width={180}
                      height={250}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* URL */}
            <div className="w-full">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {joinUrl}
                </span>
                <button
                  onClick={copyUrl}
                  className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
                  aria-label="Copy join URL"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Controls */}
        <div className="space-y-4">
          {/* How it works */}
          <Card className="p-5 space-y-3">
            <h3 className="font-medium text-[15px] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              How it works
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                  1
                </span>
                Print and display the QR code at your organization
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                  2
                </span>
                Customers scan with their phone camera
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                  3
                </span>
                They enter their name and add the loyalty card to their wallet
              </li>
            </ol>
          </Card>

          {/* Download options */}
          <Card className="p-5 space-y-4">
            <h3 className="font-medium text-[15px] flex items-center gap-2">
              <Download className="w-4 h-4 text-muted-foreground" />
              Download for printing
            </h3>

            {/* Size presets */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-muted-foreground">
                Size
              </label>
              <div className="grid gap-2">
                {SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedSize(preset.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      selectedSize === preset.id
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <QrCode
                        className={`w-4 h-4 ${
                          selectedSize === preset.id
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="font-medium">{preset.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {preset.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={downloadPng}
              disabled={downloading}
              className="flex w-full items-center justify-center gap-2 h-10 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {downloading ? "Generating..." : "Download PNG"}
            </button>
          </Card>

          {/* NFC note */}
          <Card className="p-5 space-y-2">
            <h3 className="font-medium text-[15px]">NFC Tags</h3>
            <p className="text-sm text-muted-foreground">
              You can also program NFC tags with your join URL. When customers tap
              the tag with their phone, they'll be taken directly to your
              onboarding page.
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 mt-2">
              <code className="text-xs text-muted-foreground truncate">
                {joinUrl}
              </code>
            </div>
          </Card>
        </div>

        {/* Hidden canvas for PNG export */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
