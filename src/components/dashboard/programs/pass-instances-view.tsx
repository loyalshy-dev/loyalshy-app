"use client"

import { useCallback, useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  Users,
  Search,
  Smartphone,
  Apple,
  ChevronLeft,
  ChevronRight,
  Wallet,
  CheckCircle,
  PauseCircle,
  XCircle,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Ban,
  Undo2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import {
  parseCouponConfig,
  parseMembershipConfig,
  parsePointsConfig,
  parsePrepaidConfig,
  formatCouponValue,
} from "@/lib/pass-config"
import type { PassInstanceListItem, PassInstanceStats } from "@/server/template-actions"
import { updatePassInstanceStatus } from "@/server/template-actions"

// ─── Props ─────────────────────────────────────────────────────

type PassInstancesViewProps = {
  result: {
    items: PassInstanceListItem[]
    total: number
    page: number
    perPage: number
  }
  stats: PassInstanceStats
  templateId: string
  passType: string
  templateConfig: unknown
  search: string
  status: string
  page: number
}

// ─── Status styles ─────────────────────────────────────────────

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  COMPLETED: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  SUSPENDED: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  EXPIRED: "bg-muted text-muted-foreground",
  REVOKED: "bg-red-500/10 text-red-700 dark:text-red-400",
  VOIDED: "bg-muted text-muted-foreground line-through",
}

// ─── Type-aware helpers ────────────────────────────────────────

function getProgressColumnHeader(passType: string): string {
  switch (passType) {
    case "STAMP_CARD": return "Progress"
    case "COUPON": return "Status"
    case "MEMBERSHIP": return "Check-ins"
    case "POINTS": return "Balance"
    case "PREPAID": return "Remaining"
    case "GIFT_CARD": return "Balance"
    case "TICKET": return "Scans"
    case "ACCESS": return "Granted"
    case "TRANSIT": return "Status"
    case "BUSINESS_ID": return "Verified"
    default: return "Activity"
  }
}

function getProgressValue(
  passType: string,
  data: unknown,
  templateConfig: unknown
): { text: string; progress?: number } {
  const d = (data ?? {}) as Record<string, unknown>

  switch (passType) {
    case "STAMP_CARD": {
      const current = (d.currentCycleStamps as number) ?? 0
      const cfg = (templateConfig ?? {}) as Record<string, unknown>
      const required = (cfg.stampsRequired as number) ?? 10
      return {
        text: `${current}/${required}`,
        progress: required > 0 ? current / required : 0,
      }
    }
    case "COUPON": {
      const redeemed = d.redeemed as boolean
      return { text: redeemed ? "Redeemed" : "Available" }
    }
    case "MEMBERSHIP": {
      const checkIns = (d.totalCheckIns as number) ?? 0
      return { text: `${checkIns}` }
    }
    case "POINTS": {
      const balance = (d.pointsBalance as number) ?? 0
      const config = parsePointsConfig(templateConfig)
      const label = config?.pointsLabel ?? "pts"
      return { text: `${balance.toLocaleString()} ${label}` }
    }
    case "PREPAID": {
      const remaining = (d.remainingUses as number) ?? 0
      const config = parsePrepaidConfig(templateConfig)
      const total = config?.totalUses ?? 0
      return {
        text: `${remaining}/${total}`,
        progress: total > 0 ? remaining / total : 0,
      }
    }
    case "GIFT_CARD": {
      const balanceCents = (d.balanceCents as number) ?? 0
      const currency = (d.currency as string) ?? "USD"
      return { text: `${(balanceCents / 100).toFixed(2)} ${currency}` }
    }
    case "TICKET": {
      const scans = (d.scanCount as number) ?? 0
      return { text: `${scans}` }
    }
    case "ACCESS": {
      const granted = (d.totalGranted as number) ?? 0
      return { text: `${granted}` }
    }
    case "TRANSIT": {
      const isBoarded = d.isBoarded as boolean
      return { text: isBoarded ? "In transit" : "Idle" }
    }
    case "BUSINESS_ID": {
      const verifications = (d.totalVerifications as number) ?? 0
      return { text: `${verifications}` }
    }
    default:
      return { text: "—" }
  }
}

// ─── Stat card ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">
        {value}
      </p>
    </Card>
  )
}

// ─── Mini progress bar ─────────────────────────────────────────

function MiniProgressBar({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, 0), 1)
  return (
    <div className="w-16 h-1.5 rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-brand transition-all"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}

// ─── Wallet icon ───────────────────────────────────────────────

function WalletIcon({ provider }: { provider: string }) {
  if (provider === "APPLE") return <Apple className="size-3.5" />
  if (provider === "GOOGLE") return <Smartphone className="size-3.5" />
  return null
}

// ─── Row actions ───────────────────────────────────────────────

function RowActions({
  passInstanceId,
  currentStatus,
  onStatusChange,
}: {
  passInstanceId: string
  currentStatus: string
  onStatusChange: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleAction(newStatus: "ACTIVE" | "SUSPENDED" | "REVOKED") {
    startTransition(async () => {
      const result = await updatePassInstanceStatus(passInstanceId, newStatus)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        const labels = { ACTIVE: "activated", SUSPENDED: "suspended", REVOKED: "revoked" }
        toast.success(`Pass ${labels[newStatus]}`)
        onStatusChange()
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isPending}
          aria-label="Pass actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {currentStatus === "SUSPENDED" && (
          <DropdownMenuItem onClick={() => handleAction("ACTIVE")}>
            <Undo2 className="size-3.5 mr-2" />
            Reactivate
          </DropdownMenuItem>
        )}
        {currentStatus === "ACTIVE" && (
          <DropdownMenuItem onClick={() => handleAction("SUSPENDED")}>
            <ShieldOff className="size-3.5 mr-2" />
            Suspend
          </DropdownMenuItem>
        )}
        {(currentStatus === "ACTIVE" || currentStatus === "SUSPENDED") && (
          <DropdownMenuItem
            onClick={() => handleAction("REVOKED")}
            className="text-destructive focus:text-destructive"
          >
            <Ban className="size-3.5 mr-2" />
            Revoke
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Main component ────────────────────────────────────────────

export function PassInstancesView({
  result,
  stats,
  templateId,
  passType,
  templateConfig,
  search,
  status,
  page,
}: PassInstancesViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const totalPages = Math.ceil(result.total / result.perPage)
  const progressHeader = getProgressColumnHeader(passType)

  const buildUrl = useCallback(
    (overrides: Record<string, string | number>) => {
      const params = new URLSearchParams()
      const merged = { search, status, page, ...overrides }
      if (merged.search) params.set("search", String(merged.search))
      if (merged.status && merged.status !== "all")
        params.set("status", String(merged.status))
      if (Number(merged.page) > 1)
        params.set("page", String(merged.page))
      const qs = params.toString()
      return qs ? `${pathname}?${qs}` : pathname
    },
    [pathname, search, status, page]
  )

  const statusFilters = [
    { key: "all", label: "All", count: stats.total },
    { key: "ACTIVE", label: "Active", count: stats.active },
    { key: "COMPLETED", label: "Completed", count: stats.completed },
    { key: "SUSPENDED", label: "Suspended", count: stats.suspended },
    { key: "EXPIRED", label: "Expired", count: stats.expired },
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Passes" value={stats.total} icon={Users} />
        <StatCard label="Active" value={stats.active} icon={CheckCircle} />
        <StatCard label="Suspended" value={stats.suspended} icon={PauseCircle} />
        <StatCard label="In Wallet" value={stats.withWallet} icon={Wallet} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            defaultValue={search}
            onChange={(e) => {
              const val = e.target.value
              const timeout = setTimeout(() => {
                router.push(buildUrl({ search: val, page: 1 }))
              }, 300)
              return () => clearTimeout(timeout)
            }}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() =>
                router.push(buildUrl({ status: f.key, page: 1 }))
              }
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                status === f.key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
              <span className="ml-1.5 text-[11px] opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {result.items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold">No passes found</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {search
              ? "No passes match your search."
              : "No passes have been issued for this program yet."}
          </p>
        </Card>
      ) : (
        <>
          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Contact
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      {progressHeader}
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">
                      Wallet
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">
                      Issued
                    </th>
                    <th className="w-10 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((pi) => {
                    const pv = getProgressValue(passType, pi.data, templateConfig)
                    return (
                      <tr
                        key={pi.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-[13px]">
                              {pi.contact.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {pi.contact.email ?? pi.contact.phone ?? "—"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px] px-1.5 py-0",
                              statusStyles[pi.status] ?? ""
                            )}
                          >
                            {pi.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium tabular-nums">
                              {pv.text}
                            </span>
                            {pv.progress !== undefined && (
                              <MiniProgressBar value={pv.progress} />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <WalletIcon provider={pi.walletProvider} />
                            <span className="text-xs">
                              {pi.walletProvider === "NONE"
                                ? "—"
                                : pi.walletProvider === "APPLE"
                                  ? "Apple"
                                  : "Google"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden sm:table-cell">
                          {formatDistanceToNow(new Date(pi.issuedAt), {
                            addSuffix: true,
                          })}
                        </td>
                        <td className="px-2 py-3">
                          <RowActions
                            passInstanceId={pi.id}
                            currentStatus={pi.status}
                            onStatusChange={() => router.refresh()}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {result.total} pass{result.total !== 1 ? "es" : ""} total
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() =>
                    router.push(buildUrl({ page: page - 1 }))
                  }
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages}
                  onClick={() =>
                    router.push(buildUrl({ page: page + 1 }))
                  }
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
