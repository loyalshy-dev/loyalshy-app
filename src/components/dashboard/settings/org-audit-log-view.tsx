"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowLeft, ArrowRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { OrgAuditLogEntry } from "@/server/org-settings-actions"

const ACTIONS = [
  "INVITATION_SENT",
  "INVITATION_RESENT",
  "INVITATION_CANCELLED",
  "INVITATION_ACCEPTED",
  "MEMBER_REMOVED",
  "MEMBER_ROLE_CHANGED",
] as const

type Props = {
  logs: OrgAuditLogEntry[]
  total: number
  pageCount: number
  page: number
  search: string
  action: string
}

export function OrgAuditLogView({ logs, total, pageCount, page, search, action }: Props) {
  const t = useTranslations("dashboard.auditLog")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === "all") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    // Reset pagination on filter changes; preserve when only the page changes.
    if (key !== "page") params.delete("page")
    const qs = params.toString()
    startTransition(() => {
      router.push(`/dashboard/settings/audit-log${qs ? `?${qs}` : ""}`)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Link href="/dashboard/settings?tab=team">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("backToTeam")}
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            defaultValue={search}
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam("search", e.currentTarget.value)
            }}
            className="pl-9"
          />
        </div>
        <Select value={action} onValueChange={(v) => setParam("action", v)}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterAll")}</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {t(`action.${a}` as never)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {logs.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </Card>
      ) : (
        <Card className="divide-y">
          {logs.map((log) => (
            <div key={log.id} className="px-4 py-3 flex items-start gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {t(`action.${log.action}` as never)}
                </div>
                <div className="text-muted-foreground text-xs mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>
                    {t("by")}{" "}
                    <span className="text-foreground">
                      {log.actor?.email ?? log.actorEmail ?? t("unknownActor")}
                    </span>
                  </span>
                  {log.targetLabel ? (
                    <span>
                      {t("target")}{" "}
                      <span className="text-foreground">{log.targetLabel}</span>
                    </span>
                  ) : null}
                  <MetadataHint metadata={log.metadata} />
                </div>
              </div>
              <time
                className="text-xs text-muted-foreground whitespace-nowrap"
                dateTime={log.createdAt.toISOString()}
                title={log.createdAt.toLocaleString()}
              >
                {formatRelative(log.createdAt)}
              </time>
            </div>
          ))}
        </Card>
      )}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("pageOf", { page, total: pageCount, count: total })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setParam("page", String(page + 1))}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MetadataHint({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== "object") return null
  const m = metadata as Record<string, unknown>
  // Surface only fields likely to be useful at a glance — role for invites,
  // previousRole/newRole for promotions/demotions. Anything else stays in
  // the JSON blob for debugging via DB.
  const bits: string[] = []
  if (typeof m.role === "string") bits.push(`role: ${m.role}`)
  if (typeof m.previousRole === "string" && typeof m.newRole === "string") {
    bits.push(`${m.previousRole} → ${m.newRole}`)
  }
  if (bits.length === 0) return null
  return <span className="text-foreground/70">{bits.join(" · ")}</span>
}

function formatRelative(date: Date): string {
  const ms = Date.now() - date.getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}
