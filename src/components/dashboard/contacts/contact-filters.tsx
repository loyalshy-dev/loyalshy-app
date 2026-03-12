"use client"

import { useTransition, useRef, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Search, X, Download } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PASS_TYPE_META, type PassType } from "@/types/pass-types"
import { exportContactsCSV } from "@/server/contact-actions"
import { toast } from "sonner"

const ALL_PASS_TYPES = Object.keys(PASS_TYPE_META) as PassType[]

type ContactFiltersProps = {
  search: string
  hasReward: string
  programType: string
  totalResults: number
}

export function ContactFilters({
  search,
  hasReward,
  programType,
  totalResults,
}: ContactFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isExporting, startExport] = useTransition()
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchDebounced = useCallback(
    (value: string) => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = setTimeout(() => handleSearch(value), 300)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams.toString()]
  )

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    // Reset to page 1 when filters change
    params.delete("page")
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function handleSearch(value: string) {
    updateParams({ search: value || null })
  }

  function handleRewardFilter(value: string) {
    updateParams({ reward: value === hasReward ? null : value })
  }

  function handleTypeFilter(value: string) {
    updateParams({ type: value === programType ? null : value })
  }

  function clearFilters() {
    startTransition(() => {
      router.push(pathname, { scroll: false })
    })
  }

  async function handleExport() {
    startExport(async () => {
      try {
        const csv = await exportContactsCSV()
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `customers-${new Date().toISOString().split("T")[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Customers exported")
      } catch {
        toast.error("Failed to export customers")
      }
    })
  }

  const hasActiveFilters = search || hasReward !== "all" || programType !== "all"

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone..."
            defaultValue={search}
            onChange={(e) => handleSearchDebounced(e.target.value)}
            className="pl-8 h-8 text-[13px]"
          />
        </div>

        {/* Export CSV */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-[13px] text-muted-foreground shrink-0"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Filter
        </span>

        {/* Has Reward chip */}
        <button
          onClick={() => handleRewardFilter(hasReward === "yes" ? "all" : "yes")}
          className="focus:outline-none"
        >
          <Badge
            variant={hasReward === "yes" ? "default" : "outline"}
            className={`cursor-pointer text-[11px] px-2 py-0.5 ${
              hasReward === "yes"
                ? ""
                : "hover:bg-accent"
            }`}
          >
            Has Reward
          </Badge>
        </button>

        {/* Program type chips */}
        {ALL_PASS_TYPES.map((passType) => {
          const meta = PASS_TYPE_META[passType]
          const Icon = meta.icon
          const isActive = programType === passType
          return (
            <button
              key={passType}
              onClick={() => handleTypeFilter(passType)}
              className="focus:outline-none"
            >
              <Badge
                variant={isActive ? "default" : "outline"}
                className={`cursor-pointer text-[11px] px-2 py-0.5 gap-1 ${
                  isActive ? "" : "hover:bg-accent"
                }`}
              >
                <Icon className="size-3" />
                {meta.shortLabel}
              </Badge>
            </button>
          )
        })}

        {/* Active filters count + clear */}
        {hasActiveFilters && (
          <>
            <div className="w-px h-4 bg-border" />
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3" />
              Clear filters
            </button>
          </>
        )}

        {/* Result count */}
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {isPending ? "..." : `${totalResults} customer${totalResults !== 1 ? "s" : ""}`}
        </span>
      </div>
    </div>
  )
}
