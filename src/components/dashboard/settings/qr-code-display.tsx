"use client"

import { useTranslations } from "next-intl"

import { useState, useRef } from "react"
import QRCode from "qrcode"
import {
  Download,
  FileText,
  QrCode,
  Smartphone,
} from "lucide-react"
import { TemplateCardPreview } from "@/components/template-card-preview"
import { StyledQrCode, renderStyledQr, drawQrLogo, loadLogoImage } from "@/components/styled-qr-code"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { parseCouponConfig, formatCouponValue } from "@/lib/pass-config"

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
  const t = useTranslations("dashboard.distribution")
  const activeTemplate = templates[0] ?? null
  const activeTemplateDesign = activeTemplate?.cardDesign ?? null
  const activeTemplateType = activeTemplate?.passType
  const activeTemplateConfig = activeTemplate?.templateConfig
  const couponConfig = activeTemplateType === "COUPON" ? parseCouponConfig(activeTemplateConfig) : null

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

  const [downloading, setDownloading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  async function downloadQrOnly() {
    setDownloading(true)
    try {
      const qrSize = 1024
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = qrSize
      canvas.height = qrSize

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Render styled QR as SVG, then draw to canvas
      const posterAccentColor =
        activeTemplateDesign?.primaryColor ?? organization.brandColor ?? "#1a1a2e"

      const qr = QRCode.create(joinUrl, { errorCorrectionLevel: "H" })
      const styledSvg = renderStyledQr(
        qr.modules,
        qrSize,
        organization.name.charAt(0).toUpperCase(),
        { bg: posterAccentColor, fg: "#ffffff" }
      )
      const svgBlob = new Blob([styledSvg], { type: "image/svg+xml" })
      const svgUrl = URL.createObjectURL(svgBlob)

      const qrImage = new window.Image()
      await new Promise<void>((resolve) => {
        qrImage.onload = () => resolve()
        qrImage.src = svgUrl
      })
      URL.revokeObjectURL(svgUrl)

      // Transparent background
      ctx.clearRect(0, 0, qrSize, qrSize)
      ctx.drawImage(qrImage, 0, 0, qrSize, qrSize)

      // Draw logo on center
      if (qrLogoUrl) {
        const logoImg = await loadLogoImage(qrLogoUrl)
        if (logoImg) drawQrLogo(ctx, qrSize, qr.modules.size, posterAccentColor, logoImg)
      }

      const suffix = activeTemplate
        ? `${activeTemplate.name.toLowerCase().replace(/\s+/g, "-")}-qr`
        : "qr"
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

  /**
   * Render the styled QR (with logo + brand color) onto the offscreen canvas
   * and return a data URL. Shared between PNG and PDF exports.
   * Returns null if the canvas can't be acquired.
   */
  async function renderQrToCanvasDataUrl(size: number): Promise<string | null> {
    const canvas = canvasRef.current
    if (!canvas) return null

    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    const posterAccentColor =
      activeTemplateDesign?.primaryColor ?? organization.brandColor ?? "#1a1a2e"

    const qr = QRCode.create(joinUrl, { errorCorrectionLevel: "H" })
    const styledSvg = renderStyledQr(
      qr.modules,
      size,
      organization.name.charAt(0).toUpperCase(),
      { bg: posterAccentColor, fg: "#ffffff" }
    )
    const svgBlob = new Blob([styledSvg], { type: "image/svg+xml" })
    const svgUrl = URL.createObjectURL(svgBlob)

    const qrImage = new window.Image()
    await new Promise<void>((resolve) => {
      qrImage.onload = () => resolve()
      qrImage.src = svgUrl
    })
    URL.revokeObjectURL(svgUrl)

    // White background under the QR (so the PDF renders cleanly on paper)
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(qrImage, 0, 0, size, size)

    if (qrLogoUrl) {
      const logoImg = await loadLogoImage(qrLogoUrl)
      if (logoImg) drawQrLogo(ctx, size, qr.modules.size, posterAccentColor, logoImg)
    }

    return canvas.toDataURL("image/png", 1.0)
  }

  async function downloadQrPdf() {
    setDownloading(true)
    try {
      const qrDataUrl = await renderQrToCanvasDataUrl(1024)
      if (!qrDataUrl) return

      const { jsPDF } = await import("jspdf")
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })

      const pageWidth = pdf.internal.pageSize.getWidth() // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight() // 297mm

      // Org name above QR
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(28)
      pdf.setTextColor(31, 20, 16) // INK
      pdf.text(organization.name, pageWidth / 2, 55, {
        align: "center",
        maxWidth: pageWidth - 40,
      })

      // QR centered
      const qrSizeMm = 130
      const qrX = (pageWidth - qrSizeMm) / 2
      const qrY = 75
      pdf.addImage(qrDataUrl, "PNG", qrX, qrY, qrSizeMm, qrSizeMm)

      // Tagline below QR
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(18)
      pdf.setTextColor(31, 20, 16)
      pdf.text(
        t("posterTagline"),
        pageWidth / 2,
        qrY + qrSizeMm + 22,
        { align: "center", maxWidth: pageWidth - 40 }
      )

      // Footer
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(11)
      pdf.setTextColor(127, 127, 127)
      pdf.text(
        "Powered by Loyalshy · loyalshy.com",
        pageWidth / 2,
        pageHeight - 18,
        { align: "center" }
      )

      const suffix = activeTemplate
        ? `${activeTemplate.name.toLowerCase().replace(/\s+/g, "-")}-poster`
        : "poster"
      pdf.save(`${organization.slug}-${suffix}.pdf`)
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
        <h3 className="text-sm font-medium">{t("qrTitle")}</h3>
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
                        : t("rewardAfterVisits", { reward: activeTemplate.rewardDescription, visits: activeTemplate.visitsRequired })}
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
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={downloadQrOnly}
              disabled={downloading}
              variant="outline"
              className="w-full gap-2"
            >
              <Download className="size-4" />
              {downloading ? t("generating") : t("downloadPng")}
            </Button>
            <Button
              onClick={downloadQrPdf}
              disabled={downloading}
              className="w-full gap-2"
            >
              <FileText className="size-4" />
              {downloading ? t("generating") : t("downloadPdf")}
            </Button>
          </div>

          {/* NFC note */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Smartphone className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[12px] text-muted-foreground">
              {t("qrNfcNote")}
            </p>
          </div>
        </div>
      </div>

      {/* Hidden canvas for PNG export */}
      <canvas ref={canvasRef} className="hidden" />
    </Card>
  )
}
