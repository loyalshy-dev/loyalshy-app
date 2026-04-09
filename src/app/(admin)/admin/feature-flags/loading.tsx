import { Skeleton } from "@/components/ui/skeleton"

export default function AdminFeatureFlagsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}
