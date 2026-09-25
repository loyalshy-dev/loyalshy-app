"use client"

import { useState, useSyncExternalStore, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Megaphone, Send, Loader2, Sparkles, Clock, AlertTriangle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useTranslations, useLocale } from "next-intl"
import { sendProgramAnnouncement } from "@/server/announcement-actions"
import type { AnnouncementQuota } from "@/lib/announcement-quota"
import { cn } from "@/lib/utils"

const MAX_LENGTH = 160

// Dates are formatted in the viewer's timezone, which the server (UTC) can't
// know — render them only after hydration to avoid a mismatch.
const noopSubscribe = () => () => {}
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

type AnnouncementSectionProps = {
  templateId: string
  programActive: boolean
  lastAnnouncement: { message: string; sentAt: string } | null
  quota: AnnouncementQuota
  planName: string
  /** Sends on THIS program in the last 24h reached the Google delivery cap */
  programCapReached: boolean
  /** Next plan that raises the quota, if any */
  upgrade: { name: string; limit: number } | null
  canManageBilling: boolean
  walletHolders: number
}

export function AnnouncementSection({
  templateId,
  programActive,
  lastAnnouncement,
  quota,
  planName,
  programCapReached,
  upgrade,
  canManageBilling,
  walletHolders,
}: AnnouncementSectionProps) {
  const t = useTranslations("dashboard.distribution")
  const locale = useLocale()
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const hydrated = useHydrated()

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })

  const unlimited = quota.limit === null
  const exhausted = quota.remaining === 0
  // Sends to zero wallet holders are refused server-side (they'd burn quota)
  const noHolders = walletHolders === 0
  const blocked = quota.inactive || exhausted || noHolders || programCapReached
  const trimmed = message.trim()
  const canSend = programActive && !blocked && trimmed.length > 0 && !isPending

  function handleSend() {
    setConfirmOpen(false)
    startTransition(async () => {
      const result = await sendProgramAnnouncement({ templateId, message: trimmed })
      if ("error" in result) {
        toast.error(result.error)
        // Quota changed under us (another program / teammate) — resync the card
        if (result.code) router.refresh()
        return
      }
      toast.success(t("announcementSent", { count: result.recipients }))
      setMessage("")
      router.refresh()
    })
  }

  const quotaLabel = unlimited
    ? t("announcementQuotaUnlimited")
    : quota.period === "lifetime"
      ? t("announcementQuotaLifetime", { remaining: quota.remaining ?? 0, limit: quota.limit ?? 0 })
      : t("announcementQuotaWeek", { remaining: quota.remaining ?? 0, limit: quota.limit ?? 0 })

  const planLabel = unlimited
    ? t("announcementPlanUnlimited", { plan: planName })
    : quota.period === "lifetime"
      ? t("announcementPlanLifetime", { plan: planName, limit: quota.limit ?? 0 })
      : t("announcementPlanWeek", { plan: planName, limit: quota.limit ?? 0 })

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-brand/10">
          <Megaphone className="size-3.5 text-brand" />
        </div>
        <h3 className="text-sm font-medium">{t("announcementTitle")}</h3>
      </div>

      <p className="text-[13px] text-muted-foreground">
        {t("announcementDescription")}
      </p>

      {/* Quota meter */}
      <div className="rounded-lg border border-border px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium tabular-nums">{quotaLabel}</span>
          {!unlimited && quota.limit !== null && quota.limit <= 10 && (
            <div
              className="flex items-center gap-1"
              role="img"
              aria-label={quotaLabel}
            >
              {Array.from({ length: quota.limit }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-4 rounded-full",
                    i < (quota.remaining ?? 0) ? "bg-brand" : "bg-muted"
                  )}
                />
              ))}
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {planLabel} · {t("announcementSharedHint")}
        </p>
      </div>

      {quota.inactive ? (
        <Notice
          icon={<AlertTriangle className="size-3.5" />}
          tone="warning"
          text={t("announcementSubscriptionInactive")}
          action={
            canManageBilling ? (
              <Link href="/dashboard/settings?tab=billing" className="font-medium underline underline-offset-2">
                {t("announcementFixBilling")}
              </Link>
            ) : null
          }
        />
      ) : exhausted ? (
        <Notice
          icon={<Clock className="size-3.5" />}
          tone="muted"
          text={
            quota.period === "lifetime"
              ? t("announcementUsedFree", { limit: quota.limit ?? 0 })
              : quota.nextAvailableAt && hydrated
                ? t("announcementUsedWeek", { date: formatDate(quota.nextAvailableAt) })
                : t("announcementUsedWeekNoDate")
          }
          action={
            upgrade ? (
              canManageBilling ? (
                <Button asChild size="sm" variant="outline" className="h-7 gap-1.5 text-[12px]">
                  <Link href="/dashboard/settings?tab=billing">
                    <Sparkles className="size-3.5" />
                    {t("announcementUpgradeCta", { plan: upgrade.name, limit: upgrade.limit })}
                  </Link>
                </Button>
              ) : (
                <span>{t("announcementAskOwner", { plan: upgrade.name })}</span>
              )
            ) : null
          }
        />
      ) : noHolders && programActive ? (
        <Notice
          icon={<Megaphone className="size-3.5" />}
          tone="muted"
          text={t("announcementNoHolders")}
        />
      ) : programCapReached ? (
        <Notice
          icon={<Clock className="size-3.5" />}
          tone="muted"
          text={t("announcementProgramCap")}
        />
      ) : null}

      <div className="space-y-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
          placeholder={t("announcementPlaceholder")}
          rows={2}
          maxLength={MAX_LENGTH}
          disabled={!programActive || blocked || isPending}
          aria-label={t("announcementTitle")}
          className="resize-none text-[13px]"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {message.length}/{MAX_LENGTH}
          </span>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!canSend}
            onClick={() => setConfirmOpen(true)}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            {t("announcementSend")}
          </Button>
        </div>
      </div>

      {!programActive && (
        <p className="text-[12px] text-amber-600 dark:text-amber-500">
          {t("announcementNotActive")}
        </p>
      )}

      {lastAnnouncement && (
        <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
          <p className="text-[13px] truncate">{lastAnnouncement.message}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {hydrated
              ? t("announcementLastSent", { date: formatDate(lastAnnouncement.sentAt) })
              : "\u00a0"}
          </p>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("announcementConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("announcementConfirmBody", { count: walletHolders })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-[13px]">
            {trimmed}
          </div>
          {!unlimited && quota.remaining !== null && (
            <p className="text-[12px] text-muted-foreground">
              {quota.period === "lifetime"
                ? t("announcementConfirmQuotaLifetime", { left: quota.remaining - 1 })
                : t("announcementConfirmQuotaWeek", { left: quota.remaining - 1 })}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("announcementConfirmCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend}>
              {t("announcementConfirmSend")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function Notice({
  icon,
  text,
  action,
  tone,
}: {
  icon: React.ReactNode
  text: string
  action?: React.ReactNode
  tone: "muted" | "warning"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-[12px] sm:flex-row sm:items-center sm:justify-between",
        tone === "warning"
          ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
          : "border-border bg-muted/40 text-muted-foreground"
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span>{text}</span>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
