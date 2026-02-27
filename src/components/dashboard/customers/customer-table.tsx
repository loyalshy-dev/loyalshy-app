"use client"

import { useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { getCustomerColumns } from "./customer-columns"
import type { CustomerRow } from "@/server/customer-actions"

type CustomerTableProps = {
  customers: CustomerRow[]
  pageCount: number
  currentPage: number
  total: number
  sort: string
  order: "asc" | "desc"
  onViewDetail: (customer: CustomerRow) => void
  onEdit: (customer: CustomerRow) => void
  onDelete: (customer: CustomerRow) => void
}

export function CustomerTable({
  customers,
  pageCount,
  currentPage,
  total,
  sort,
  order,
  onViewDetail,
  onEdit,
  onDelete,
}: CustomerTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

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
    const newOrder = sort === field && order === "asc" ? "desc" : "asc"
    updateParams({ sort: field, order: newOrder, page: null })
  }

  function handlePage(page: number) {
    updateParams({ page: page > 1 ? page.toString() : null })
  }

  const columns = getCustomerColumns(
    { onViewDetail, onEdit, onDelete }
  )

  const table = useReactTable({
    data: customers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount,
    state: {
      sorting: sort
        ? [{ id: sort, desc: order === "desc" }]
        : [],
    },
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater(sort ? [{ id: sort, desc: order === "desc" }] : [])
          : updater
      if (next.length > 0) {
        handleSort(next[0].id)
      }
    },
  })

  return (
    <div className={`rounded-lg border border-border bg-card ${isPending ? "opacity-60" : ""} transition-opacity`}>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent border-border">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="h-9 px-4 first:pl-4">
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
                className="h-32 text-center text-[13px] text-muted-foreground"
              >
                No customers match your filters.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer border-border min-h-[44px]"
                onClick={() => onViewDetail(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-3 first:pl-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-[11px] text-muted-foreground tabular-nums">
            Page {currentPage} of {pageCount}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => handlePage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
              let page: number
              if (pageCount <= 5) {
                page = i + 1
              } else if (currentPage <= 3) {
                page = i + 1
              } else if (currentPage >= pageCount - 2) {
                page = pageCount - 4 + i
              } else {
                page = currentPage - 2 + i
              }
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="icon-sm"
                  onClick={() => handlePage(page)}
                  className="tabular-nums text-[12px]"
                >
                  {page}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => handlePage(currentPage + 1)}
              disabled={currentPage >= pageCount}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
