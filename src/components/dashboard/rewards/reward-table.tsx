"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { format, formatDistanceToNow } from "date-fns"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table"
import { ArrowUpDown, Gift, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { RewardRow } from "@/server/reward-actions"

// ─── Status config ──────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  AVAILABLE: {
    label: "Available",
    className: "bg-success/10 text-success border-success/20",
  },
  REDEEMED: {
    label: "Redeemed",
    className: "bg-brand/10 text-brand border-brand/20",
  },
  EXPIRED: {
    label: "Expired",
    className: "bg-muted text-muted-foreground border-border",
  },
}

// ─── Avatar helpers ─────────────────────────────────────────

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `oklch(0.55 0.12 ${hue})`
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

// ─── Types ──────────────────────────────────────────────────

type RewardTableProps = {
  rewards: RewardRow[]
  pageCount: number
  currentPage: number
  total: number
  sort: string
  order: "asc" | "desc"
  activeTab: string
  onRedeem: (reward: RewardRow) => void
  basePath?: string
}

// ─── Mobile Card Component ──────────────────────────────────

function RewardCard({
  reward,
  activeTab,
  onRedeem,
}: {
  reward: RewardRow
  activeTab: string
  onRedeem: (reward: RewardRow) => void
}) {
  const cfg = statusConfig[reward.status] ?? statusConfig.EXPIRED
  const isExpiringSoon =
    new Date(reward.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white"
            style={{ backgroundColor: getAvatarColor(reward.contactName) }}
          >
            {getInitials(reward.contactName)}
          </div>
          <span className="text-[13px] font-medium truncate">
            {reward.contactName}
          </span>
        </div>
        <Badge
          variant="outline"
          className={`text-[11px] px-1.5 py-0 shrink-0 ${cfg.className}`}
        >
          {cfg.label}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 text-[13px]">
        <Gift className="size-3.5 text-brand shrink-0" />
        <span className="truncate">{reward.description}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-muted-foreground">
          Earned {format(new Date(reward.earnedAt), "MMM d, yyyy")}
        </span>
        {activeTab === "available" && (
          <span
            className={`text-[12px] ${
              isExpiringSoon ? "text-warning font-medium" : "text-muted-foreground"
            }`}
          >
            Expires {formatDistanceToNow(new Date(reward.expiresAt), { addSuffix: true })}
          </span>
        )}
        {activeTab === "redeemed" && reward.redeemedAt && (
          <span className="text-[12px] text-muted-foreground">
            Redeemed {format(new Date(reward.redeemedAt), "MMM d")}
          </span>
        )}
      </div>

      {activeTab === "available" && (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 text-[13px] gap-1.5"
          onClick={() => onRedeem(reward)}
        >
          <CheckCircle2 className="size-3.5" />
          Redeem
        </Button>
      )}
    </div>
  )
}

// ─── Pagination ─────────────────────────────────────────────

function Pagination({
  currentPage,
  pageCount,
  total,
  updateParams,
}: {
  currentPage: number
  pageCount: number
  total: number
  updateParams: (updates: Record<string, string>) => void
}) {
  if (pageCount <= 1) return null

  return (
    <div className="flex items-center justify-between">
      <p className="text-[12px] text-muted-foreground tabular-nums">
        Page {currentPage} of {pageCount} ({total} total)
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={currentPage <= 1}
          onClick={() => updateParams({ page: String(currentPage - 1) })}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={currentPage >= pageCount}
          onClick={() => updateParams({ page: String(currentPage + 1) })}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export function RewardTable({
  rewards,
  pageCount,
  currentPage,
  total,
  sort,
  order,
  activeTab,
  onRedeem,
  basePath = "/dashboard/rewards",
}: RewardTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    router.push(`${basePath}?${params.toString()}`)
  }

  function toggleSort(field: string) {
    const newOrder = sort === field && order === "asc" ? "desc" : "asc"
    updateParams({ sort: field, order: newOrder })
  }

  function SortableHeader({
    field,
    children,
  }: {
    field: string
    children: React.ReactNode
  }) {
    return (
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded text-[12px]"
        onClick={() => toggleSort(field)}
      >
        {children}
        <ArrowUpDown className="size-3 text-muted-foreground/60" />
      </button>
    )
  }

  const columns: ColumnDef<RewardRow>[] = [
    {
      accessorKey: "contactName",
      header: () => <span className="text-[12px]">Contact</span>,
      cell: ({ row }) => {
        const name = row.original.contactName
        return (
          <div className="flex items-center gap-2.5">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white"
              style={{ backgroundColor: getAvatarColor(name) }}
            >
              {getInitials(name)}
            </div>
            <span className="text-[13px] font-medium truncate max-w-40">
              {name}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "description",
      header: () => <span className="text-[12px]">Reward</span>,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Gift className="size-3.5 text-brand shrink-0" />
          <span className="text-[13px] truncate max-w-35">
            {row.original.description}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "earnedAt",
      header: () => <SortableHeader field="earnedAt">Earned</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">
          {format(new Date(row.original.earnedAt), "MMM d, yyyy")}
        </span>
      ),
      meta: { className: "hidden sm:table-cell" },
    },
    ...(activeTab === "available"
      ? [
          {
            accessorKey: "expiresAt" as const,
            header: () => (
              <SortableHeader field="expiresAt">Expires</SortableHeader>
            ),
            cell: ({ row }: { row: { original: RewardRow } }) => {
              const exp = new Date(row.original.expiresAt)
              const isExpiringSoon =
                exp.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
              return (
                <span
                  className={`text-[13px] ${
                    isExpiringSoon
                      ? "text-warning font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {formatDistanceToNow(exp, { addSuffix: true })}
                </span>
              )
            },
            meta: { className: "hidden md:table-cell" },
          } satisfies ColumnDef<RewardRow>,
        ]
      : []),
    ...(activeTab === "redeemed"
      ? [
          {
            accessorKey: "redeemedAt" as const,
            header: () => (
              <SortableHeader field="redeemedAt">Redeemed</SortableHeader>
            ),
            cell: ({ row }: { row: { original: RewardRow } }) =>
              row.original.redeemedAt ? (
                <span className="text-[13px] text-muted-foreground">
                  {format(new Date(row.original.redeemedAt), "MMM d, yyyy")}
                </span>
              ) : (
                <span className="text-[13px] text-muted-foreground">—</span>
              ),
            meta: { className: "hidden md:table-cell" },
          } satisfies ColumnDef<RewardRow>,
        ]
      : []),
    {
      accessorKey: "status",
      header: () => <span className="text-[12px]">Status</span>,
      cell: ({ row }) => {
        const cfg =
          statusConfig[row.original.status] ?? statusConfig.EXPIRED
        return (
          <Badge
            variant="outline"
            className={`text-[11px] px-1.5 py-0 ${cfg.className}`}
          >
            {cfg.label}
          </Badge>
        )
      },
      meta: { className: "hidden sm:table-cell" },
    },
    ...(activeTab === "available"
      ? [
          {
            id: "actions",
            header: () => <span className="text-[12px]">Actions</span>,
            cell: ({ row }: { row: { original: RewardRow } }) => (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[12px] gap-1"
                onClick={() => onRedeem(row.original)}
              >
                <CheckCircle2 className="size-3" />
                Redeem
              </Button>
            ),
          } satisfies ColumnDef<RewardRow>,
        ]
      : []),
  ]

  const table = useReactTable({
    data: rewards,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  })

  return (
    <div className="space-y-3">
      {/* Mobile card list (below md) */}
      <div className="md:hidden space-y-2">
        {rewards.length === 0 ? (
          <div className="text-center text-[13px] text-muted-foreground py-10 border border-border rounded-lg">
            No rewards found.
          </div>
        ) : (
          rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              activeTab={activeTab}
              onRedeem={onRedeem}
            />
          ))
        )}
      </div>

      {/* Desktop table (md and above) */}
      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as { className?: string } | undefined
                    return (
                      <TableHead
                        key={header.id}
                        className={`h-9 text-[12px] text-muted-foreground font-medium ${meta?.className ?? ""}`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center text-[13px] text-muted-foreground py-10"
                  >
                    No rewards found.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="min-h-11">
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as { className?: string } | undefined
                      return (
                        <TableCell key={cell.id} className={`py-3 ${meta?.className ?? ""}`}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        pageCount={pageCount}
        total={total}
        updateParams={updateParams}
      />
    </div>
  )
}
