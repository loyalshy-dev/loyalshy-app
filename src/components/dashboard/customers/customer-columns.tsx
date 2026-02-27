"use client"

import { formatDistanceToNow } from "date-fns"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CustomerRow } from "@/server/customer-actions"

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
        const { primaryEnrollment, enrollmentCount } = row.original

        if (!primaryEnrollment) {
          return (
            <span className="text-[12px] text-muted-foreground">
              No active programs
            </span>
          )
        }

        const { currentCycleVisits, visitsRequired, programName } = primaryEnrollment
        const pct = Math.min((currentCycleVisits / visitsRequired) * 100, 100)

        return (
          <div className="flex items-center gap-2">
            {/* Mini progress bar */}
            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[13px] tabular-nums text-muted-foreground">
              {currentCycleVisits}/{visitsRequired}
            </span>
            <span className="text-[11px] text-muted-foreground truncate max-w-[100px] hidden lg:inline">
              {enrollmentCount > 1
                ? `+${enrollmentCount - 1} more`
                : programName}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "totalVisits",
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
          {row.original.totalVisits}
        </span>
      ),
    },
    {
      accessorKey: "lastVisitAt",
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
        const date = row.original.lastVisitAt
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
