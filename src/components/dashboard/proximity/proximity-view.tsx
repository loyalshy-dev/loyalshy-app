"use client"

import { useState, useTransition } from "react"
import { Check, Info, Loader2, MapPin, Smartphone, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PROXIMITY_MESSAGE_MAX, proximitySettingsSchema } from "@/lib/proximity/config"
import type { ProximityDashboardData } from "@/lib/proximity/dashboard"
import { saveProximitySettings } from "@/server/proximity-actions"
import { AddressAutocomplete } from "@/components/studio/address-autocomplete"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type ProximityViewProps = {
  data: ProximityDashboardData
  organizationName: string
}

export function ProximityView({ data, organizationName }: ProximityViewProps) {
  const t = useTranslations("dashboard.proximity")
  const initial = data.settings

  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [address, setAddress] = useState(initial?.address ?? "")
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial ? { lat: initial.latitude, lng: initial.longitude } : null,
  )
  const [message, setMessage] = useState(
    initial ? initial.message ?? "" : t("defaultMessage").slice(0, PROXIMITY_MESSAGE_MAX),
  )
  const [isSaving, startSaving] = useTransition()

  function handleAddress(next: string, lat: number | null, lng: number | null) {
    setAddress(next)
    setCoords(lat != null && lng != null ? { lat, lng } : null)
  }

  function handleSave() {
    if (!coords) {
      toast.error(t("errorNoLocation"))
      return
    }
    const parsed = proximitySettingsSchema.safeParse({
      enabled,
      address,
      latitude: coords.lat,
      longitude: coords.lng,
      message,
    })
    if (!parsed.success) {
      toast.error(t("errorInvalid"))
      return
    }
    startSaving(async () => {
      let result: Awaited<ReturnType<typeof saveProximitySettings>>
      try {
        result = await saveProximitySettings(parsed.data)
      } catch {
        toast.error(t("errorInvalid"))
        return
      }
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(parsed.data.enabled ? t("savedOn") : t("savedOff"))
    })
  }

  const lockScreenText = message.trim() || organizationName

  return (
    <div className="space-y-6">
      <Card className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">{t("settingsTitle")}</h3>
              <p className="text-[13px] text-muted-foreground">{t("settingsDescription")}</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={t("enableLabel")} />
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
            <Smartphone className="mt-0.5 size-4 shrink-0" />
            <p className="text-[12px] leading-relaxed">
              <span className="font-medium">{t("iphoneOnlyTitle")}</span> {t("iphoneOnlyBody")}
            </p>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label className="text-[13px]">{t("addressLabel")}</Label>
            <AddressAutocomplete
              value={address}
              onChange={handleAddress}
              placeholder={t("addressPlaceholder")}
              maxLength={500}
              labels={{ searching: t("searching"), noResults: t("noResults") }}
            />
            {address && (
              <p
                className={cn(
                  "flex items-center gap-1.5 text-[11px]",
                  coords ? "text-muted-foreground" : "text-amber-600",
                )}
              >
                <MapPin className="size-3 shrink-0" />
                {coords ? t("locationSet") : t("pickFromList")}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">{t("addressHint")}</p>
          </div>

          {/* Lock-screen text */}
          <div className="space-y-2">
            <Label htmlFor="proximity-message" className="text-[13px]">{t("messageLabel")}</Label>
            <Input
              id="proximity-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, PROXIMITY_MESSAGE_MAX))}
              maxLength={PROXIMITY_MESSAGE_MAX}
              placeholder={organizationName}
              className="text-[13px]"
            />
            <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{t("messageHint")}</span>
              <span className="tabular-nums">{message.length}/{PROXIMITY_MESSAGE_MAX}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              {t("save")}
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <p className="text-[13px] font-medium text-muted-foreground">{t("previewTitle")}</p>
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">{t("previewLockScreen")}</p>
            <div className="flex gap-2.5 rounded-2xl bg-muted/70 p-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
                <Wallet className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold">{organizationName}</p>
                <p className="text-[12px] leading-snug">{lockScreenText}</p>
              </div>
            </div>
          </div>
          <ul className="space-y-1.5 text-[11px] text-muted-foreground">
            {(["previewStep1", "previewStep2", "previewStep3"] as const).map((key) => (
              <li key={key} className="flex gap-1.5">
                <Check className="mt-0.5 size-3 shrink-0" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
          <p className="flex gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" />
            <span>{t("previewNote")}</span>
          </p>
        </div>
      </Card>
    </div>
  )
}
