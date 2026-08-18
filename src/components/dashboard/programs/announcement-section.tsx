"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Megaphone, Send, Loader2 } from "lucide-react"
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

const MAX_LENGTH = 160

type AnnouncementSectionProps = {
  templateId: string
  programActive: boolean
  lastAnnouncement: { message: string; sentAt: string } | null
  remainingToday: number
  walletHolders: number
}

export function AnnouncementSection({
  templateId,
  programActive,
  lastAnnouncement,
  remainingToday,
  walletHolders,
}: AnnouncementSectionProps) {
  const t = useTranslations("dashboard.distribution")
  const locale = useLocale()
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const trimmed = message.trim()
  const canSend = programActive && trimmed.length > 0 && remainingToday > 0 && !isPending

  function handleSend() {
    setConfirmOpen(false)
    startTransition(async () => {
      const result = await sendProgramAnnouncement({ templateId, message: trimmed })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(t("announcementSent", { count: result.recipients }))
      setMessage("")
      router.refresh()
    })
  }

  const lastSentDate = lastAnnouncement
    ? new Date(lastAnnouncement.sentAt).toLocaleString(locale, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-brand/10">
            <Megaphone className="size-3.5 text-brand" />
          </div>
          <h3 className="text-sm font-medium">{t("announcementTitle")}</h3>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {t("announcementQuota", { count: remainingToday })}
        </span>
      </div>

      <p className="text-[13px] text-muted-foreground">
        {t("announcementDescription")}
      </p>

      <div className="space-y-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
          placeholder={t("announcementPlaceholder")}
          rows={2}
          maxLength={MAX_LENGTH}
          disabled={!programActive || isPending}
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
            {t("announcementLastSent", { date: lastSentDate ?? "" })}
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
