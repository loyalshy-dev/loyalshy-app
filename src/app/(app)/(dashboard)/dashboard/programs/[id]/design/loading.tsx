import { Skeleton } from "@/components/ui/skeleton"

export default function DesignLoading() {
  return (
    <div className="space-y-6">
      {/* Canvas area */}
      <div className="flex items-center justify-center min-h-[60vh]">
        <Skeleton className="h-[400px] w-[300px] rounded-2xl" />
      </div>
    </div>
  )
}
