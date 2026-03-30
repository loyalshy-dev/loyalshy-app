"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import QRCode from "qrcode"
import { Smartphone, RefreshCw, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type ConnectDeviceProps = {
  organizationName: string
}

export function ConnectDevice({ organizationName }: ConnectDeviceProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [timeLeft, setTimeLeft] = useState("")

  const generateToken = useCallback(async () => {
    setLoading(true)
    setQrDataUrl(null)
    try {
      const res = await fetch("/api/v1/auth/device-pair/create", {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to generate QR" }))
        throw new Error(err.error || "Failed to generate QR code")
      }

      const data = await res.json()
      const dataUrl = await QRCode.toDataURL(data.qrData, {
        width: 280,
        margin: 2,
        color: { dark: "#171717", light: "#ffffff" },
        errorCorrectionLevel: "M",
      })
      setQrDataUrl(dataUrl)
      setExpiresAt(new Date(data.expiresAt))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate QR code")
    } finally {
      setLoading(false)
    }
  }, [])

  // Generate token when dialog opens
  useEffect(() => {
    if (open && !qrDataUrl && !loading) {
      generateToken()
    }
  }, [open, qrDataUrl, loading, generateToken])

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return

    const tick = () => {
      const now = new Date()
      const diff = expiresAt.getTime() - now.getTime()
      if (diff <= 0) {
        setTimeLeft("Expired")
        setQrDataUrl(null)
        return
      }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  const handleClose = () => {
    setOpen(false)
    setQrDataUrl(null)
    setExpiresAt(null)
    setTimeLeft("")
  }

  return (
    <>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand/10">
              <Smartphone className="size-4 text-brand" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Staff App</h3>
              <p className="text-xs text-muted-foreground">
                Connect a device to the Loyalshy Staff Scanner app
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5">
            <Smartphone className="size-3.5" />
            Connect Device
          </Button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Connect Staff Device</DialogTitle>
            <DialogDescription>
              Open the Loyalshy Staff app and tap &quot;Scan QR from Dashboard&quot; to connect.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            {loading && (
              <div className="flex items-center justify-center size-[280px]">
                <RefreshCw className="size-6 text-muted-foreground animate-spin" />
              </div>
            )}

            {qrDataUrl && (
              <>
                <div className="rounded-2xl border border-border p-3 bg-white">
                  <img
                    src={qrDataUrl}
                    alt="Device pairing QR code"
                    width={280}
                    height={280}
                    className="rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Timer className="size-3.5" />
                  <span>
                    {timeLeft === "Expired"
                      ? "QR code expired"
                      : `Expires in ${timeLeft}`}
                  </span>
                </div>
              </>
            )}

            {!loading && !qrDataUrl && (
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-sm text-muted-foreground">QR code expired</p>
                <Button onClick={generateToken} variant="outline" size="sm" className="gap-1.5">
                  <RefreshCw className="size-3.5" />
                  Generate New QR
                </Button>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            This will sign in as you ({organizationName}) on the staff device.
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
