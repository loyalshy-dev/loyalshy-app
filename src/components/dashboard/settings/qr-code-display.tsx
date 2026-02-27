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

type ProgramInfo = {
  id: string
  name: string
  rewardDescription: string
  visitsRequired: number
}

type QrCodeDisplayProps = {
  restaurant: {
    name: string
    slug: string
    logo: string | null
    brandColor: string | null
  }
  programs: ProgramInfo[]
}

export function QrCodeDisplay({
  restaurant,
  programs,
}: QrCodeDisplayProps) {
  const hasMultiplePrograms = programs.length > 1

  // "all" = generic join URL (picker), or a program id for deep-link
  const [activeTab, setActiveTab] = useState<string>(
    hasMultiplePrograms ? "all" : programs[0]?.id ?? "all"
  )
  const [qrSvg, setQrSvg] = useState<string>("")
  const [selectedSize, setSelectedSize] = useState<string>("table-tent")
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const activeProgram = programs.find((p) => p.id === activeTab) ?? null
  const rewardDescription = activeProgram?.rewardDescription ?? programs[0]?.rewardDescription ?? "Free reward"
  const visitsRequired = activeProgram?.visitsRequired ?? programs[0]?.visitsRequired ?? 10

  const [origin, setOrigin] = useState("")
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const programId = activeTab === "all" ? null : activeTab
  const joinPath = programId
    ? `/join/${restaurant.slug}?program=${programId}`
    : `/join/${restaurant.slug}`
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
    await navigator.clipboard.writeText(joinUrl)
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

      const brandColor = restaurant.brandColor ?? "#1a1a2e"

      // Background
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Brand color bar at top
      const barHeight = Math.round(canvas.height * 0.06)
      ctx.fillStyle = brandColor
      ctx.fillRect(0, 0, canvas.width, barHeight)

      // Restaurant name
      const nameFontSize = Math.round(canvas.width * 0.05)
      ctx.fillStyle = "#111111"
      ctx.font = `600 ${nameFontSize}px -apple-system, 'Segoe UI', sans-serif`
      ctx.textAlign = "center"
      ctx.fillText(
        restaurant.name,
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
      const scanText = activeProgram
        ? `Scan to join ${activeProgram.name}`
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
      ctx.fillText(
        `Earn a free ${rewardDescription} after ${visitsRequired} visits`,
        canvas.width / 2,
        qrY +
          qrDrawSize +
          Math.round(canvas.height * 0.04) +
          rewardFontSize +
          Math.round(canvas.height * 0.015)
      )

      // Fidelio branding at bottom
      const brandFontSize = Math.round(canvas.width * 0.022)
      ctx.fillStyle = "#bbbbbb"
      ctx.font = `400 ${brandFontSize}px -apple-system, 'Segoe UI', sans-serif`
      ctx.fillText(
        "Powered by Fidelio",
        canvas.width / 2,
        canvas.height - Math.round(canvas.height * 0.03)
      )

      // Download
      const suffix = activeProgram
        ? `${activeProgram.name.toLowerCase().replace(/\s+/g, "-")}-${selectedSize}`
        : `qr-${selectedSize}`
      const link = document.createElement("a")
      link.download = `${restaurant.slug}-${suffix}.png`
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
      {/* Program tabs — only shown when multiple programs exist */}
      {hasMultiplePrograms && (
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
          {programs.map((program) => (
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
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-col items-center space-y-6">
            {/* QR code */}
            <div className="relative">
              <div
                className="w-56 h-56 sm:w-64 sm:h-64 rounded-xl bg-white p-4 shadow-sm border border-border"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              {/* Restaurant logo overlay in center */}
              {restaurant.logo && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border-2 border-white shadow-sm">
                    <Image
                      src={restaurant.logo}
                      alt=""
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Restaurant / program info */}
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-[15px]">{restaurant.name}</h3>
              {activeProgram ? (
                <>
                  <p className="text-xs font-medium text-foreground/80">{activeProgram.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Earn a free {activeProgram.rewardDescription} after {activeProgram.visitsRequired} visits
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Customers will choose from {programs.length} programs
                </p>
              )}
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
                  title="Copy URL"
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
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* How it works */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-medium text-[15px] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              How it works
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                  1
                </span>
                Print and display the QR code at your restaurant
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
          </div>

          {/* Download options */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
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
          </div>

          {/* NFC note */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
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
          </div>
        </div>

        {/* Hidden canvas for PNG export */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
