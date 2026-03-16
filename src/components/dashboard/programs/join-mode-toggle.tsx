"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Globe, Lock, Loader2 } from "lucide-react"
import { updateTemplateJoinMode } from "@/server/org-settings-actions"
import { useTranslations } from "next-intl"

type JoinModeToggleProps = {
  organizationId: string
  templateId: string
  initialJoinMode: string
}

export function JoinModeToggle({
  organizationId,
  templateId,
  initialJoinMode,
}: JoinModeToggleProps) {
  const t = useTranslations("dashboard.distribution")
  const router = useRouter()
  const [joinMode, setJoinMode] = useState(initialJoinMode)
  const [isPending, startTransition] = useTransition()

  function handleChange(mode: "OPEN" | "INVITE_ONLY") {
    if (mode === joinMode) return
    const prev = joinMode
    setJoinMode(mode)
    startTransition(async () => {
      const result = await updateTemplateJoinMode(organizationId, templateId, mode)
      if ("error" in result) {
        toast.error(String(result.error))
        setJoinMode(prev)
      } else {
        toast.success(t("joinModeUpdated"))
        router.refresh()
      }
    })
  }

  const isOpen = joinMode === "OPEN"

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{t("joinMode")}</h3>
        <p className="text-[13px] text-muted-foreground mt-1">
          {t("joinModeDescription")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleChange("OPEN")}
          className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
            isOpen
              ? "border-foreground/30 bg-accent/50"
              : "border-border hover:bg-accent/30"
          } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isPending && isOpen ? (
            <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Globe className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          )}
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("joinModeOpen")}</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {t("joinModeOpenDescription")}
            </p>
          </div>
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleChange("INVITE_ONLY")}
          className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
            !isOpen
              ? "border-foreground/30 bg-accent/50"
              : "border-border hover:bg-accent/30"
          } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isPending && !isOpen ? (
            <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          )}
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("joinModeInviteOnly")}</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {t("joinModeInviteOnlyDescription")}
            </p>
          </div>
        </button>
      </div>

      {/* Advisory note for open mode */}
      {isOpen && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {t("duplicateNote")}{" "}
            {t.rich("duplicateNoteSettings", {
              link: () => (
                <a href="/dashboard/settings" className="underline underline-offset-4 hover:text-foreground">
                  {t("duplicateNoteSettingsLink")}
                </a>
              ),
            })}
          </p>
        </div>
      )}
    </div>
  )
}
