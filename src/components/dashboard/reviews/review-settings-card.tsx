"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Check, Loader2, MapPin, Search, Star, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  REVIEW_LINK_LABEL_MAX,
  REVIEW_MESSAGE_MAX,
  REVIEW_TRIGGER_DEFAULT,
  REVIEW_TRIGGER_MAX,
  REVIEW_TRIGGER_MIN,
  reviewSettingsSchema,
} from "@/lib/reviews/config"
import type { ReviewsDashboardData } from "@/lib/reviews/dashboard"
import type { BusinessSuggestion } from "@/lib/reviews/places"
import { saveReviewSettings, searchReviewBusinesses } from "@/server/review-actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ReviewSettingsCardProps = {
  initial: ReviewsDashboardData["settings"]
  planAllowed: boolean
  placesConfigured: boolean
  organizationName: string
}

type TargetMode = "place" | "link"

const TRIGGER_OPTIONS = Array.from(
  { length: REVIEW_TRIGGER_MAX - REVIEW_TRIGGER_MIN + 1 },
  (_, i) => REVIEW_TRIGGER_MIN + i,
)

export function ReviewSettingsCard({
  initial,
  planAllowed,
  placesConfigured,
  organizationName,
}: ReviewSettingsCardProps) {
  const t = useTranslations("dashboard.reviews")

  const [enabled, setEnabled] = useState(initial?.enabled ?? false)
  const [mode, setMode] = useState<TargetMode>(
    initial?.customUrl || !placesConfigured ? "link" : "place",
  )
  const [place, setPlace] = useState<{ placeId: string; name: string } | null>(
    initial?.placeId ? { placeId: initial.placeId, name: initial.placeName ?? initial.placeId } : null,
  )
  const [customUrl, setCustomUrl] = useState(initial?.customUrl ?? "")
  const [triggerStamp, setTriggerStamp] = useState(initial?.triggerStamp ?? REVIEW_TRIGGER_DEFAULT)
  const [message, setMessage] = useState(
    initial?.message ?? t("defaultMessage", { business: organizationName }).slice(0, REVIEW_MESSAGE_MAX),
  )
  const [linkLabel, setLinkLabel] = useState(initial?.linkLabel ?? t("defaultLinkLabel"))
  const [isSaving, startSaving] = useTransition()

  function handleSave() {
    const input = {
      enabled,
      placeId: mode === "place" ? place?.placeId ?? null : null,
      placeName: mode === "place" ? place?.name ?? null : null,
      customUrl: mode === "link" ? customUrl.trim() || null : null,
      triggerStamp,
      message,
      linkLabel,
    }
    const parsed = reviewSettingsSchema.safeParse(input)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      toast.error(
        issue?.message === "missingTarget"
          ? t("errorMissingTarget")
          : issue?.message === "invalidUrl"
            ? t("errorInvalidUrl")
            : t("errorInvalid"),
      )
      return
    }
    startSaving(async () => {
      const result = await saveReviewSettings(parsed.data)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(enabled ? t("savedOn") : t("savedOff"))
    })
  }

  return (
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
            disabled={!planAllowed && !enabled}
            aria-label={t("enableLabel")}
          />
        </div>

        {/* Business */}
        <div className="space-y-2">
          <Label className="text-[13px]">{t("businessLabel")}</Label>
          {mode === "place" ? (
            place ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-[13px]">
                  <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{place.name}</span>
                </span>
                <Button size="xs" variant="ghost" onClick={() => setPlace(null)}>
                  {t("changeBusiness")}
                </Button>
              </div>
            ) : (
              <BusinessSearch onPick={(s) => setPlace({ placeId: s.placeId, name: s.name })} />
            )
          ) : (
            <Input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://g.page/r/…/review"
              inputMode="url"
              aria-label={t("linkLabelInput")}
              className="text-[13px]"
            />
          )}
          {placesConfigured && (
            <button
              type="button"
              onClick={() => setMode(mode === "place" ? "link" : "place")}
              className="text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {mode === "place" ? t("useLinkInstead") : t("searchInstead")}
            </button>
          )}
        </div>

        {/* Trigger */}
        <div className="space-y-2">
          <Label className="text-[13px]">{t("triggerLabel")}</Label>
          <Select value={String(triggerStamp)} onValueChange={(v) => setTriggerStamp(Number(v))}>
            <SelectTrigger className="w-full text-[13px] sm:w-64" aria-label={t("triggerLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-[13px]">
                  {t("triggerOption", { count: n })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{t("triggerHint")}</p>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <Label htmlFor="review-message" className="text-[13px]">{t("messageLabel")}</Label>
          <Textarea
            id="review-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, REVIEW_MESSAGE_MAX))}
            rows={2}
            maxLength={REVIEW_MESSAGE_MAX}
            className="resize-none text-[13px]"
          />
          <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{t("messageHint")}</span>
            <span className="tabular-nums">{message.length}/{REVIEW_MESSAGE_MAX}</span>
          </div>
        </div>

        {/* Link label */}
        <div className="space-y-2">
          <Label htmlFor="review-link-label" className="text-[13px]">{t("linkTextLabel")}</Label>
          <Input
            id="review-link-label"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value.slice(0, REVIEW_LINK_LABEL_MAX))}
            maxLength={REVIEW_LINK_LABEL_MAX}
            className="text-[13px] sm:w-80"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" />}
            {t("save")}
          </Button>
        </div>
      </div>

      <ReviewPreview organizationName={organizationName} message={message} linkLabel={linkLabel} />
    </Card>
  )
}

// ─── Business search ────────────────────────────────────────

function BusinessSearch({ onPick }: { onPick: (s: BusinessSuggestion) => void }) {
  const t = useTranslations("dashboard.reviews")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<BusinessSuggestion[]>([])
  const [searched, setSearched] = useState(false)
  const [isSearching, startSearch] = useTransition()
  const latest = useRef("")

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const timer = setTimeout(() => {
      latest.current = q
      startSearch(async () => {
        const found = await searchReviewBusinesses(q)
        // Ignore answers to queries the user has already typed past.
        if (latest.current !== q) return
        setResults(found)
        setSearched(true)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (e.target.value.trim().length < 2) {
              latest.current = ""
              setResults([])
              setSearched(false)
            }
          }}
          placeholder={t("searchPlaceholder")}
          aria-label={t("businessLabel")}
          className="pl-8 text-[13px]"
        />
        {isSearching && (
          <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {results.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-border" aria-label={t("businessLabel")}>
          {results.map((r) => (
            <li key={r.placeId}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="text-[13px] font-medium">{r.name}</span>
                {r.address && <span className="text-[11px] text-muted-foreground">{r.address}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && results.length === 0 && !isSearching && (
        <p className="text-[12px] text-muted-foreground">{t("noResults")}</p>
      )}
    </div>
  )
}

// ─── Preview ────────────────────────────────────────────────

function ReviewPreview({
  organizationName,
  message,
  linkLabel,
}: {
  organizationName: string
  message: string
  linkLabel: string
}) {
  const t = useTranslations("dashboard.reviews")
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
            <p className={cn("text-[12px] leading-snug", !message && "text-muted-foreground")}>
              {message || "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">{t("previewPass")}</p>
        {/* Mirrors buildAppleReviewFields once the customer was asked: the
            message row, then the link in its own row. */}
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Google</p>
          <p className={cn("text-[13px] leading-snug", !message && "text-muted-foreground")}>{message || "—"}</p>
          <p className="flex items-center gap-1.5 text-[13px] text-sky-600 dark:text-sky-400">
            <Star className="size-3.5" />
            {linkLabel || "—"}
          </p>
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
