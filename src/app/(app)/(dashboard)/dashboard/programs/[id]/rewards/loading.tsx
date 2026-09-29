import { Skeleton } from "@/components/ui/skeleton"

export default function RewardsLoading() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      {/* Tabs + search */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-48" />
      </div>
      {/* Table header */}
      <Skeleton className="h-10 w-full" />
      {/* Table rows */}
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}
