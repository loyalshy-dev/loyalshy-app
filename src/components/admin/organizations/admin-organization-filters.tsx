"use client"

import { useCallback, useRef, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type Filter = "all" | "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED"

type AdminOrganizationFiltersProps = {
  search: string
  filter: Filter
  total: number
}

const filterOptions: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "TRIALING", label: "Trialing" },
  { value: "PAST_DUE", label: "Past Due" },
  { value: "CANCELED", label: "Canceled" },
]

export function AdminOrganizationFilters({
  search,
  filter,
  total,
}: AdminOrganizationFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    params.delete("page")
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const handleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        updateParams({ search: value || null })
      }, 300)
    },
    [searchParams, pathname]
  )

  function handleFilter(value: Filter) {
    updateParams({ filter: value === filter ? null : value === "all" ? null : value })
  }

  const hasFilters = search || filter !== "all"

  function clearFilters() {
    startTransition(() => {
      router.push(pathname, { scroll: false })
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Search organizations..."
          defaultValue={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-8 h-8 text-[13px]"
        />
      </div>

      <div className="flex items-center gap-1.5">
        {filterOptions.map((f) => (
          <button key={f.value} onClick={() => handleFilter(f.value)}>
            <Badge
              variant={filter === f.value || (f.value === "all" && filter === "all") ? "default" : "outline"}
              className={`cursor-pointer text-[11px] px-2 py-0.5 ${
                filter === f.value || (f.value === "all" && filter === "all") ? "" : "hover:bg-accent"
              }`}
            >
              {f.label}
            </Badge>
          </button>
        ))}
      </div>

      {hasFilters && (
        <>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
            Clear filters
          </button>
        </>
      )}

      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
        {total} organization{total !== 1 ? "s" : ""}
      </span>
    </div>
  )
}
