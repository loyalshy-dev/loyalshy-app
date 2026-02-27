import { Skeleton } from "@/components/ui/skeleton"

export default function RewardsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-56 mt-1.5" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Skeleton className="h-9 w-64 rounded-lg" />

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-[140px]" />
        <Skeleton className="h-9 w-[140px]" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 h-9 border-b border-border bg-muted/30">
          {[120, 100, 80, 80, 60, 60].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ width: w }} />
          ))}
        </div>
        {/* Body rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 h-12 border-b border-border last:border-0"
          >
            <div className="flex items-center gap-2.5 w-[120px]">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <Skeleton className="h-3.5 w-[100px]" />
            <Skeleton className="h-3.5 w-[80px]" />
            <Skeleton className="h-3.5 w-[80px]" />
            <Skeleton className="h-5 w-[60px] rounded-full" />
            <Skeleton className="h-7 w-[60px] rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
