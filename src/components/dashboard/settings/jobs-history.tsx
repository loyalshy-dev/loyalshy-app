"use client"

import { useState, useTransition } from "react"
import { formatDistanceToNow } from "date-fns"
import { RefreshCw, CheckCircle2, AlertCircle, ArrowUpCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getRecentJobLogs, type JobLogEntry } from "@/server/jobs-actions"

// ─── Props ──────────────────────────────────────────────────

type JobsHistoryProps = {
  initialLogs: JobLogEntry[]
  initialTotal: number
}

// ─── Action Badge ───────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  switch (action) {
    case "CREATED":
      return (
        <Badge variant="default" className="gap-1 bg-emerald-600/10 text-emerald-600 border-emerald-600/20 hover:bg-emerald-600/10">
          <CheckCircle2 className="h-3 w-3" />
          Created
        </Badge>
      )
    case "UPDATED":
      return (
        <Badge variant="default" className="gap-1 bg-blue-600/10 text-blue-600 border-blue-600/20 hover:bg-blue-600/10">
          <ArrowUpCircle className="h-3 w-3" />
          Updated
        </Badge>
      )
    case "PUSH_SENT":
      return (
        <Badge variant="default" className="gap-1 bg-violet-600/10 text-violet-600 border-violet-600/20 hover:bg-violet-600/10">
          <Send className="h-3 w-3" />
          Push Sent
        </Badge>
      )
    case "PUSH_FAILED":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Push Failed
        </Badge>
      )
    default:
      return <Badge variant="outline">{action}</Badge>
  }
}

// ─── Detail Pills ───────────────────────────────────────────

function DetailPills({ details }: { details: Record<string, unknown> }) {
  const pills: { label: string; value: string }[] = []

  if (details.platform) {
    pills.push({ label: "Platform", value: String(details.platform) })
  }
  if (details.trigger) {
    pills.push({ label: "Trigger", value: String(details.trigger).replace(/_/g, " ") })
  }
  if (typeof details.devicesNotified === "number") {
    pills.push({ label: "Devices", value: String(details.devicesNotified) })
  }
  if (typeof details.pushSent === "number") {
    pills.push({ label: "Sent", value: String(details.pushSent) })
  }
  if (typeof details.pushFailed === "number" && details.pushFailed > 0) {
    pills.push({ label: "Failed", value: String(details.pushFailed) })
  }

  if (pills.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((pill) => (
        <span
          key={pill.label}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5"
        >
          <span className="font-medium">{pill.label}:</span>
          <span className="capitalize">{pill.value}</span>
        </span>
      ))}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export function JobsHistory({ initialLogs, initialTotal }: JobsHistoryProps) {
  const [logs, setLogs] = useState(initialLogs)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()

  const perPage = 25
  const pageCount = Math.ceil(total / perPage)

  function refresh() {
    startTransition(async () => {
      const result = await getRecentJobLogs(page)
      setLogs(result.logs)
      setTotal(result.total)
    })
  }

  function goToPage(newPage: number) {
    setPage(newPage)
    startTransition(async () => {
      const result = await getRecentJobLogs(newPage)
      setLogs(result.logs)
      setTotal(result.total)
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "entry" : "entries"} total
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isPending}
          className="gap-1.5"
          aria-label="Refresh job logs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium text-foreground">No job activity yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-[300px]">
            Wallet pass updates, push notifications, and other background jobs will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Details</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{log.contactName}</td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3">
                      <DetailPills details={log.details} />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || isPending}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= pageCount || isPending}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
