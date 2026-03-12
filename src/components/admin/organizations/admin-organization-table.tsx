"use client"

import { useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  MoreHorizontal,
} from "lucide-react"
import type { AdminOrganizationRow } from "@/server/admin-actions"
import { PLANS, type PlanId } from "@/lib/plans"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success border-success/20",
  TRIALING: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  PAST_DUE: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  CANCELED: "bg-muted text-muted-foreground",
}

const statusLabels: Record<string, string> = {
  ACTIVE: "Active",
  TRIALING: "Trialing",
  PAST_DUE: "Past Due",
  CANCELED: "Canceled",
}

const planStyles: Record<string, string> = {
  STARTER: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  GROWTH: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  SCALE: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  ENTERPRISE: "bg-amber-500/10 text-amber-600 border-amber-500/20",
}

type AdminOrganizationTableProps = {
  organizations: AdminOrganizationRow[]
  pageCount: number
  sort: string
  order: "asc" | "desc"
  page: number
  onSelectOrganization: (id: string) => void
}

export function AdminOrganizationTable({
  organizations,
  pageCount,
  sort,
  order,
  page,
  onSelectOrganization,
}: AdminOrganizationTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function handleSort(field: string) {
    const newOrder = sort === field && order === "desc" ? "asc" : "desc"
    updateParams({ sort: field, order: newOrder, page: null })
  }

  function handlePage(p: number) {
    updateParams({ page: p === 1 ? null : String(p) })
  }

  const columns: ColumnDef<AdminOrganizationRow>[] = [
    {
      accessorKey: "name",
      header: () => (
        <button
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => handleSort("name")}
        >
          Organization
          <ArrowUpDown className="size-3" />
        </button>
      ),
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate">{r.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {r.slug}
            </p>
          </div>
        )
      },
    },
    {
      accessorKey: "plan",
      header: "Plan",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={`text-[11px] ${planStyles[row.original.plan] ?? ""}`}
        >
          {PLANS[row.original.plan as PlanId]?.name ?? row.original.plan}
        </Badge>
      ),
    },
    {
      accessorKey: "subscriptionStatus",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.subscriptionStatus
        return (
          <Badge
            variant="outline"
            className={`text-[11px] ${statusStyles[status] ?? ""}`}
          >
            {statusLabels[status] ?? status}
          </Badge>
        )
      },
    },
    {
      id: "counts",
      header: "Users / Templates / Contacts",
      cell: ({ row }) => {
        const c = row.original._count
        return (
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {c.members} / {c.passTemplates} / {c.contacts}
          </span>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <button
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => handleSort("createdAt")}
        >
          Created
          <ArrowUpDown className="size-3" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">
          {formatDistanceToNow(new Date(row.original.createdAt), {
            addSuffix: true,
          })}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const r = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Organization actions"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onSelectOrganization(r.id)}>
                <Eye className="size-4" />
                View Details
              </DropdownMenuItem>
              {r.stripeCustomerId && (
                <DropdownMenuItem asChild>
                  <a
                    href={`https://dashboard.stripe.com/customers/${r.stripeCustomerId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" />
                    Open in Stripe
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: organizations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount,
    state: {
      sorting: [{ id: sort, desc: order === "desc" }],
      pagination: { pageIndex: page - 1, pageSize: 25 },
    },
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground h-9">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  No organizations found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => onSelectOrganization(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page <= 1}
              onClick={() => handlePage(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page >= pageCount}
              onClick={() => handlePage(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
