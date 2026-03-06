import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export function StatCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card
          key={i}
          className="p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="size-4 rounded" />
          </div>
          <Skeleton className="h-7 w-16" />
        </Card>
      ))}
    </div>
  )
}

export function VisitsChartSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-7 w-36 rounded-md" />
      </div>
      <Skeleton className="h-[260px] w-full rounded" />
    </Card>
  )
}

export function SecondaryChartSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-3.5 w-24 mb-4" />
      <Skeleton className="h-[200px] w-full rounded" />
    </Card>
  )
}

export function ActivitySkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-3.5 w-28 mb-4" />
      <div className="space-y-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 py-2.5 border-b border-border last:border-0"
          >
            <Skeleton className="size-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function TopCustomersSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-3.5 w-28 mb-4" />
      <div className="space-y-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
          >
            <Skeleton className="size-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </Card>
  )
}
