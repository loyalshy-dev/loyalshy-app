import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function CustomersLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <div className="w-px h-4 bg-border" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>

      {/* Table skeleton */}
      <Card>
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-4 w-12 hidden sm:block" />
          <Skeleton className="h-4 w-16 hidden md:block" />
          <Skeleton className="h-4 w-12 hidden lg:block" />
          <Skeleton className="size-6" />
        </div>

        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-2.5 border-b border-border last:border-0"
          >
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="size-8 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-1.5 w-16 rounded-full" />
              <Skeleton className="h-3.5 w-8" />
            </div>
            <Skeleton className="h-3.5 w-8 hidden sm:block" />
            <Skeleton className="h-3.5 w-16 hidden md:block" />
            <Skeleton className="h-5 w-14 rounded-full hidden lg:block" />
            <Skeleton className="size-6" />
          </div>
        ))}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <Skeleton className="h-3 w-20" />
          <div className="flex items-center gap-1">
            <Skeleton className="size-6 rounded-md" />
            <Skeleton className="size-6 rounded-md" />
            <Skeleton className="size-6 rounded-md" />
            <Skeleton className="size-6 rounded-md" />
          </div>
        </div>
      </Card>
    </div>
  )
}
