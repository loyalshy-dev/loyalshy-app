"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Check, Loader2, Sparkles, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  WINBACK_DAY_OPTIONS,
  WINBACK_DAYS_DEFAULT,
  WINBACK_HOLDOUT_PERCENT,
  WINBACK_MESSAGE_MAX,
  winbackSettingsSchema,
  type WinbackDays,
} from "@/lib/winback/config"
import type { WinbackDashboardData } from "@/lib/winback/dashboard"
import { countWinbackEligible, saveWinbackSettings } from "@/server/winback-actions"
import { WinbackResultsCard } from "./winback-results"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type WinbackViewProps = {
  data: WinbackDashboardData
  organizationName: string
  canManageBilling: boolean
}

export function WinbackView({ data, organizationName, canManageBilling }: WinbackViewProps) {
  const t = useTranslations("dashboard.winback")
  const initial = data.settings

  const [enabled, setEnabled] = useState(initial?.enabled ?? false)
  const [inactiveDays, setInactiveDays] = useState<WinbackDays>(initial?.inactiveDays ?? WINBACK_DAYS_DEFAULT)
  const [message, setMessage] = useState(
    initial?.message ?? t("defaultMessage", { business: organizationName }).slice(0, WINBACK_MESSAGE_MAX),
  )
  const [holdout, setHoldout] = useState(initial?.holdout ?? true)
  const [includeExisting, setIncludeExisting] = useState(initial?.includeExisting ?? false)
  const [saved, setSaved] = useState({ enabled: initial?.enabled ?? false })
  const [isSaving, startSaving] = useTransition()

  // Turning it on now: offer the first-run choice. Once on, the choice is history.
  const turningOn = enabled && !saved.enabled

  const [counts, setCounts] = useState<{ current: number; reachable: number; alreadyInactive: number } | null>(null)
  const [isCounting, startCounting] = useTransition()
  const [countFailed, setCountFailed] = useState(false)
  useEffect(() => {
    startCounting(async () => {
      // A throw inside a transition reaches the error boundary and takes the
      // whole page down — the counter is a nice-to-have, so swallow it.
      try {
        const [current, all] = await Promise.all([
          countWinbackEligible({ inactiveDays, includeExisting }),
          countWinbackEligible({ inactiveDays, includeExisting: true }),
        ])
        if (current && all) {
          setCounts({ current: current.eligible, reachable: current.reachable, alreadyInactive: all.eligible })
        }
      } catch {
        setCountFailed(true)
        return
      }
      setCountFailed(false)
    })
  }, [inactiveDays, includeExisting, saved.enabled])

  function handleSave() {
    const parsed = winbackSettingsSchema.safeParse({ enabled, inactiveDays, message, holdout, includeExisting })
    if (!parsed.success) {
      toast.error(t("errorInvalid"))
      return
    }
    startSaving(async () => {
      let result: Awaited<ReturnType<typeof saveWinbackSettings>>
      try {
        result = await saveWinbackSettings(parsed.data)
      } catch {
        toast.error(t("errorInvalid"))
        return
      }
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setSaved({ enabled: parsed.data.enabled })
      toast.success(parsed.data.enabled ? t("savedOn") : t("savedOff"))
    })
  }

  return (
    <div className="space-y-6">
      {!data.planAllowed && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
            <p className="text-[13px]">{t("planRequired")}</p>
          </div>
          {canManageBilling ? (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/dashboard/settings?tab=billing">{t("upgradeCta")}</Link>
            </Button>
          ) : (
            <span className="text-[12px] text-muted-foreground">{t("askOwner")}</span>
          )}
        </Card>
      )}

      <WinbackResultsCard results={data.results} holdoutOn={initial?.holdout ?? true} />

      <Card className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">{t("settingsTitle")}</h3>
              <p className="text-[13px] text-muted-foreground">{t("settingsDescription")}</p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={!data.planAllowed && !enabled}
              aria-label={t("enableLabel")}
            />
          </div>

          {/* Inactivity threshold */}
          <div className="space-y-2">
            <Label className="text-[13px]">{t("daysLabel")}</Label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("daysLabel")}>
              {WINBACK_DAY_OPTIONS.map((days) => (
                <Button
                  key={days}
                  type="button"
                  size="sm"
                  variant={inactiveDays === days ? "ink" : "outline"}
                  role="radio"
                  aria-checked={inactiveDays === days}
                  onClick={() => setInactiveDays(days)}
                >
                  {t("daysOption", { days })}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{t("daysHint")}</p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="winback-message" className="text-[13px]">{t("messageLabel")}</Label>
            <Textarea
              id="winback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, WINBACK_MESSAGE_MAX))}
              rows={2}
              maxLength={WINBACK_MESSAGE_MAX}
              className="resize-none text-[13px]"
            />
            <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{t("messageHint")}</span>
              <span className="tabular-nums">{message.length}/{WINBACK_MESSAGE_MAX}</span>
            </div>
          </div>

          {/* First run: only when switching it on */}
          {turningOn && (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-[13px] font-medium">{t("firstRunLabel")}</legend>
              <Choice
                checked={!includeExisting}
                onSelect={() => setIncludeExisting(false)}
                title={t("firstRunFromNow")}
                hint={t("firstRunFromNowHint", { days: inactiveDays })}
              />
              <Choice
                checked={includeExisting}
                onSelect={() => setIncludeExisting(true)}
                title={t("firstRunIncludeExisting", { count: counts?.alreadyInactive ?? 0 })}
                hint={t("firstRunIncludeExistingHint")}
              />
            </fieldset>
          )}

          {/* Comparison group */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <p className="text-[13px] font-medium">{t("holdoutLabel", { percent: WINBACK_HOLDOUT_PERCENT })}</p>
              <p className="text-[11px] text-muted-foreground">{t("holdoutHint")}</p>
            </div>
            <Switch checked={holdout} onCheckedChange={setHoldout} aria-label={t("holdoutLabel", { percent: WINBACK_HOLDOUT_PERCENT })} />
          </div>

          {/* Live reach (hidden if the count can't be fetched) */}
          {!countFailed && (
            <p className={cn("text-[12px] text-muted-foreground", isCounting && "opacity-60")} aria-live="polite">
              {counts === null
                ? t("countLoading")
                : t("countToday", { count: counts.current, reachable: counts.reachable })}
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              {t("save")}
            </Button>
          </div>
        </div>

        <WinbackPreview organizationName={organizationName} message={message} />
      </Card>

      <p className="text-[12px] text-muted-foreground">{t("promiseNote")}</p>
    </div>
  )
}

function Choice({
  checked,
  onSelect,
  title,
  hint,
}: {
  checked: boolean
  onSelect: () => void
  title: string
  hint: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        checked ? "border-foreground" : "border-border hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-foreground bg-foreground text-background" : "border-muted-foreground/40",
        )}
      >
        {checked && <Check className="size-2.5" />}
      </span>
      <span className="space-y-0.5">
        <span className="block text-[13px] font-medium">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  )
}

function WinbackPreview({ organizationName, message }: { organizationName: string; message: string }) {
  const t = useTranslations("dashboard.winback")
  return (
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
            <p className={cn("text-[12px] leading-snug", !message && "text-muted-foreground")}>{message || "—"}</p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">{t("previewPass")}</p>
        <div className="space-y-1 rounded-xl border border-border p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{organizationName}</p>
          <p className={cn("text-[13px] leading-snug", !message && "text-muted-foreground")}>{message || "—"}</p>
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
    </div>
  )
}
