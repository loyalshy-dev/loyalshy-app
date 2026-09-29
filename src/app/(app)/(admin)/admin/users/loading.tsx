import { Skeleton } from "@/components/ui/skeleton"

export default function AdminUsersLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-32" />
      {/* Search + filters */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-28" />
      </div>
      {/* Table */}
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
