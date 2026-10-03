"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Globe, Lock, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { setProgramJoinMode } from "@/server/distribution-actions"
import { cn } from "@/lib/utils"

// Who can get a pass for this program: anyone with the QR / link (public)
// or only the team (invite only). Two options as a radio group; the page
// hides the QR, link and NFC sections while the program is invite only.

type JoinMode = "PUBLIC" | "INVITE_ONLY"

const OPTIONS: { value: JoinMode; Icon: typeof Globe; label: string; description: string }[] = [
  { value: "PUBLIC", Icon: Globe, label: "joinModeOpen", description: "joinModeOpenDescription" },
  { value: "INVITE_ONLY", Icon: Lock, label: "joinModeInviteOnly", description: "joinModeInviteOnlyDescription" },
]

export function JoinModeSection({ templateId, joinMode }: { templateId: string; joinMode: JoinMode }) {
  const t = useTranslations("dashboard.distribution")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function select(next: JoinMode) {
    if (next === joinMode || isPending) return
    startTransition(async () => {
      const result = await setProgramJoinMode({ templateId, joinMode: next })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(t("joinModeUpdated"))
      router.refresh()
    })
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-brand/10">
          <Lock className="size-3.5 text-brand" />
        </div>
        <h3 className="text-sm font-medium">{t("joinMode")}</h3>
        {isPending && <Loader2 className="ml-auto size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
      </div>
      <p className="text-[13px] text-muted-foreground">{t("joinModeDescription")}</p>

      <div role="radiogroup" aria-label={t("joinMode")} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {OPTIONS.map(({ value, Icon, label, description }) => {
          const checked = value === joinMode
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={isPending}
              onClick={() => select(value)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-70",
                checked ? "border-foreground bg-foreground/[0.04]" : "border-border hover:bg-muted/50",
              )}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", checked ? "text-foreground" : "text-muted-foreground")} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{t(label)}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{t(description)}</span>
              </span>
            </button>
          )
        })}
      </div>

      {joinMode === "INVITE_ONLY" && (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-[12px] leading-snug text-muted-foreground">{t("joinModeInviteOnlyNotice")}</p>
      )}
    </Card>
  )
}
