import { Skeleton } from "@/components/ui/skeleton"

export default function DistributionLoading() {
  return (
    <div className="space-y-6">
      {/* Join mode toggle */}
      <Skeleton className="h-12 w-full max-w-sm" />
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-72 rounded-lg" />
        <div className="space-y-6">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
