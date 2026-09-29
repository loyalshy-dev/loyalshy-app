import { Skeleton } from "@/components/ui/skeleton"
import {
  StatCardsSkeleton,
  VisitsChartSkeleton,
  SecondaryChartSkeleton,
  ActivitySkeleton,
  TopCustomersSkeleton,
} from "@/components/dashboard/overview/skeletons"

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>
      <StatCardsSkeleton />
      <VisitsChartSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <SecondaryChartSkeleton />
        <SecondaryChartSkeleton />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ActivitySkeleton />
        </div>
        <div className="lg:col-span-2">
          <TopCustomersSkeleton />
        </div>
      </div>
    </div>
  )
}
