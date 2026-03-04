"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type RewardFiltersProps = {
  search: string
  dateFrom: string
  dateTo: string
  totalResults: number
  basePath?: string
}

export function RewardFilters({
  search: initialSearch,
  dateFrom: initialDateFrom,
  dateTo: initialDateTo,
  totalResults,
  basePath = "/dashboard/rewards",
}: RewardFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(initialSearch)

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (search) {
        params.set("search", search)
      } else {
        params.delete("search")
      }
      params.delete("page")
      router.push(`${basePath}?${params.toString()}`)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search, searchParams, router])

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page")
      router.push(`${basePath}?${params.toString()}`)
    },
    [searchParams, router]
  )

  const hasDateFilter = initialDateFrom || initialDateTo

  function clearDateFilter() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("dateFrom")
    params.delete("dateTo")
    params.delete("page")
    router.push(`${basePath}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 flex-1">
        {/* Search */}
        <div className="relative flex-1 min-w-45">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-[13px]"
          />
        </div>

        {/* Date range — wraps to second row on mobile */}
        <div className="hidden sm:flex items-center gap-2">
          <Input
            type="date"
            value={initialDateFrom}
            onChange={(e) => updateParam("dateFrom", e.target.value)}
            className="h-9 text-[13px] w-35"
            placeholder="From"
          />
          <span className="text-[13px] text-muted-foreground">to</span>
          <Input
            type="date"
            value={initialDateTo}
            onChange={(e) => updateParam("dateTo", e.target.value)}
            className="h-9 text-[13px] w-35"
            placeholder="To"
          />
          {hasDateFilter && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={clearDateFilter}
              className="shrink-0"
              aria-label="Clear date filter"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground shrink-0 tabular-nums">
        {totalResults} {totalResults === 1 ? "reward" : "rewards"}
      </p>
    </div>
  )
}
