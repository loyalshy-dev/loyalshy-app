import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* Tab navigation skeleton */}
      <div className="flex gap-1 border-b border-border pb-px">
        {["General", "Loyalty Program", "Team", "Billing"].map((tab) => (
          <Skeleton key={tab} className="h-9 w-28 rounded-md" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="space-y-6">
        <Card className="p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center gap-4 mt-4">
            <Skeleton className="h-20 w-20 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
