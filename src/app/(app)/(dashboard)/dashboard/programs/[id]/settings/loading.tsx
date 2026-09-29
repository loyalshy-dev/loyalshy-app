import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Status section */}
      <Skeleton className="h-32 rounded-lg" />
      {/* Danger zone */}
      <Skeleton className="h-24 rounded-lg" />
    </div>
  )
}
