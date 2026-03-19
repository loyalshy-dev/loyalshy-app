"use client"

import { useEffect, useRef, useState, useCallback } from "react"

type UseQrScannerProps = {
  onScan: (data: string) => void
  enabled: boolean
}

type UseQrScannerReturn = {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isStarting: boolean
  error: string | null
  hasCamera: boolean | null
  restart: () => void
}

export function useQrScanner({
  onScan,
  enabled,
}: UseQrScannerProps): UseQrScannerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scannerRef = useRef<import("qr-scanner").default | null>(null)
  const onScanRef = useRef(onScan)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasCamera, setHasCamera] = useState<boolean | null>(null)

  // Keep callback ref fresh without re-triggering effect
  onScanRef.current = onScan

  // Check camera availability once
  useEffect(() => {
    let cancelled = false
    import("qr-scanner").then((mod) => {
      const QrScanner = mod.default
      QrScanner.hasCamera().then((result) => {
        if (!cancelled) setHasCamera(result)
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return

    setIsStarting(true)
    setError(null)

    try {
      const mod = await import("qr-scanner")
      const QrScanner = mod.default

      // Destroy existing scanner if any
      if (scannerRef.current) {
        scannerRef.current.destroy()
        scannerRef.current = null
      }

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          // Pause scanner to prevent duplicate scans while server action runs
          scanner.pause()
          onScanRef.current(result.data)
        },
        {
          preferredCamera: "environment",
          highlightScanRegion: false,
          highlightCodeOutline: false,
          maxScansPerSecond: 5,
        }
      )

      scannerRef.current = scanner
      await scanner.start()
      setIsStarting(false)
    } catch (err) {
      setIsStarting(false)
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Camera access denied. Allow in browser settings, or search by name.")
      } else {
        setError("Could not start camera. Try again or search by name.")
      }
    }
  }, [])

  // Start/stop scanner based on enabled flag
  useEffect(() => {
    if (enabled) {
      startScanner()
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.destroy()
        scannerRef.current = null
      }
    }
  }, [enabled, startScanner])

  const restart = useCallback(() => {
    // Fully destroy existing scanner to release camera before retrying
    if (scannerRef.current) {
      scannerRef.current.destroy()
      scannerRef.current = null
    }
    // Small delay lets the browser fully release the camera before re-acquiring
    setTimeout(() => {
      startScanner()
    }, 300)
  }, [startScanner])

  return {
    videoRef,
    isStarting,
    error,
    hasCamera,
    restart,
  }
}
