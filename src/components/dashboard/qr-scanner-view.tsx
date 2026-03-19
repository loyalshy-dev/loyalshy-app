"use client"

import { Loader2, AlertCircle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQrScanner } from "@/hooks/use-qr-scanner"

type QrScannerViewProps = {
  onScan: (data: string) => void
  isProcessing: boolean
  error: string | null
  onRetry: () => void
  /** Controls whether the scanner is actively scanning. Defaults to true. */
  enabled?: boolean
  /** Compact mode hides helper text and back link — used in combined mobile layout. */
  compact?: boolean
  onBack?: () => void
}

export function QrScannerView({
  onScan,
  isProcessing,
  error: scanError,
  onRetry,
  enabled = true,
  compact = false,
  onBack,
}: QrScannerViewProps) {
  const {
    videoRef,
    isStarting,
    error: cameraError,
    restart,
  } = useQrScanner({
    onScan,
    enabled,
  })

  const displayError = cameraError || scanError

  function handleRetry() {
    if (cameraError) {
      restart()
    } else {
      onRetry()
      restart()
    }
  }

  return (
    <div className={`flex flex-col items-center ${compact ? "gap-2" : "gap-3"} px-4 ${compact ? "pb-2" : "pb-4"}`}>
      {/* Camera viewport */}
      <div className={`relative w-full ${compact ? "aspect-video" : "aspect-4/3"} rounded-xl overflow-hidden bg-black`}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Loading state */}
        {isStarting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black">
            <Loader2 className="size-6 text-white/60 animate-spin" />
            <p className="text-[12px] text-white/50">Starting camera...</p>
          </div>
        )}

        {/* Paused overlay (enabled=false but no error) */}
        {!enabled && !cameraError && !isStarting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <p className="text-[12px] text-white/60">Scanner paused</p>
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm">
            <Loader2 className="size-6 text-white animate-spin" />
            <p className="text-[13px] text-white font-medium">Looking up customer...</p>
          </div>
        )}

        {/* Scan frame overlay (only when camera is active and not processing) */}
        {enabled && !isStarting && !cameraError && !isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`relative ${compact ? "size-32" : "size-48"} max-w-[70%] max-h-[70%]`}>
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-brand rounded-tl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-brand rounded-tr" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-brand rounded-bl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-brand rounded-br" />

              {/* Scan line animation */}
              <div
                className="absolute left-2 right-2 h-px bg-brand/50"
                style={{ animation: "scan-line 2s ease-in-out infinite" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error banner */}
      {displayError && (
        <div className="flex items-start gap-2 w-full rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-destructive leading-relaxed">
              {displayError}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5 mt-2"
              onClick={handleRetry}
            >
              <RotateCcw className="size-3" />
              Try again
            </Button>
          </div>
        </div>
      )}

      {/* Helper text — only in standalone (non-compact) mode */}
      {!compact && !displayError && (
        <p className="text-[12px] text-muted-foreground text-center">
          Point camera at the QR code on the wallet pass
        </p>
      )}

      {/* Back link — only in standalone (non-compact) mode */}
      {!compact && onBack && (
        <button
          type="button"
          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={onBack}
        >
          or search by name instead
        </button>
      )}
    </div>
  )
}
