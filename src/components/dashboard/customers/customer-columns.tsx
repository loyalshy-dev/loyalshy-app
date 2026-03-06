"use client"

import { formatDistanceToNow } from "date-fns"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Eye, Pencil, Trash2, Stamp, Ticket, Crown, Coins, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import type { ContactRow as CustomerRow } from "@/server/contact-actions"

const typeIcons: Record<string, typeof Stamp> = {
  STAMP_CARD: Stamp,
  COUPON: Ticket,
  MEMBERSHIP: Crown,
  POINTS: Coins,
  PREPAID: CreditCard,
}

const typeLabels: Record<string, string> = {
  STAMP_CARD: "Stamp",
  COUPON: "Coupon",
  MEMBERSHIP: "Member",
  POINTS: "Points",
  PREPAID: "Prepaid",
}

// Deterministic avatar color from name
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

type ColumnActions = {
  onViewDetail: (customer: CustomerRow) => void
  onEdit: (customer: CustomerRow) => void
  onDelete: (customer: CustomerRow) => void
}

export function getCustomerColumns(
  actions: ColumnActions
): ColumnDef<CustomerRow>[] {
  return [
    {
      accessorKey: "fullName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="xs"
          className="-ml-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="size-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const customer = row.original
        return (
          <button
            onClick={() => actions.onViewDetail(customer)}
            className="flex items-center gap-3 text-left group"
          >
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white"
              style={{ backgroundColor: getAvatarColor(customer.fullName) }}
            >
              {getInitials(customer.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate group-hover:text-brand transition-colors">
                {customer.fullName}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {customer.email ?? customer.phone ?? "No contact"}
              </p>
            </div>
          </button>
        )
      },
    },
    {
      id: "programType",
      header: () => (
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Program
        </span>
      ),
      cell: ({ row }) => {
        const { primaryPassInstance, passInstanceCount } = row.original
        if (!primaryPassInstance) {
          return <span className="text-[12px] text-muted-foreground">—</span>
        }
        const TypeIcon = typeIcons[primaryPassInstance.passType] ?? Stamp
        const typeLabel = typeLabels[primaryPassInstance.passType] ?? "Program"
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[11px] px-1.5 py-0 gap-1 shrink-0">
              <TypeIcon className="size-3" />
              {typeLabel}
            </Badge>
            {passInstanceCount > 1 && (
              <span className="text-[10px] text-muted-foreground">
                +{passInstanceCount - 1}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: "progress",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="xs"
          className="-ml-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Progress
          <ArrowUpDown className="size-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const { primaryPassInstance, hasAvailableReward } = row.original

        if (!primaryPassInstance) {
          return <span className="text-[12px] text-muted-foreground">—</span>
        }

        const piData = (primaryPassInstance.data ?? {}) as Record<string, unknown>
        const currentCycleVisits = (piData.currentCycleStamps as number) ?? (piData.currentCycleVisits as number) ?? 0
        const piConfig = (primaryPassInstance.templateConfig ?? {}) as Record<string, unknown>
        const visitsRequired = (piConfig.stampsRequired as number) ?? (piConfig.visitsRequired as number) ?? 10
        const programType = primaryPassInstance.passType

        if (programType === "COUPON") {
          return (
            <span className="text-[12px] text-muted-foreground">
              {hasAvailableReward ? "Ready" : "Redeemed"}
            </span>
          )
        }

        if (programType === "MEMBERSHIP") {
          return (
            <span className="text-[12px] text-muted-foreground">Active</span>
          )
        }

        if (programType === "POINTS") {
          return (
            <span className="text-[13px] tabular-nums text-muted-foreground">
              {(piData.pointsBalance as number) ?? 0} pts
            </span>
          )
        }

        if (programType === "PREPAID") {
          const remaining = (piData.remainingUses as number) ?? 0
          const total = (piConfig.totalUses as number) ?? 0
          const pct = total > 0 ? Math.min((remaining / total) * 100, 100) : 0

          return (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[13px] tabular-nums text-muted-foreground">
                {remaining}/{total}
              </span>
            </div>
          )
        }

        // STAMP_CARD (default)
        const pct = Math.min((currentCycleVisits / visitsRequired) * 100, 100)

        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[13px] tabular-nums text-muted-foreground">
              {currentCycleVisits}/{visitsRequired}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "totalInteractions",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="xs"
          className="-ml-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground hidden sm:flex"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Total
          <ArrowUpDown className="size-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-[13px] tabular-nums hidden sm:inline">
          {row.original.totalInteractions}
        </span>
      ),
    },
    {
      accessorKey: "lastInteractionAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="xs"
          className="-ml-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground hidden md:flex"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Last Visit
          <ArrowUpDown className="size-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = row.original.lastInteractionAt
        if (!date) return <span className="text-[13px] text-muted-foreground hidden md:inline">Never</span>
        return (
          <span className="text-[13px] text-muted-foreground hidden md:inline">
            {formatDistanceToNow(new Date(date), { addSuffix: true })}
          </span>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const customer = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Customer actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => actions.onViewDetail(customer)}
                className="text-[13px]"
              >
                <Eye className="size-3.5" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => actions.onEdit(customer)}
                className="text-[13px]"
              >
                <Pencil className="size-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => actions.onDelete(customer)}
                className="text-[13px] text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
