import { Suspense } from "react"
import { connection } from "next/server"
import { assertAdminRole } from "@/lib/dal"
import { getFeatureFlags } from "@/server/admin-actions"
import { FeatureFlagsView } from "@/components/admin/feature-flags/feature-flags-view"
import { Skeleton } from "@/components/ui/skeleton"

export default async function FeatureFlagsPage() {
  await connection()
  await assertAdminRole("ADMIN_OPS")

  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      }
    >
      <FeatureFlagsSection />
    </Suspense>
  )
}

async function FeatureFlagsSection() {
  const { disabledPassTypes } = await getFeatureFlags()

  return <FeatureFlagsView disabledPassTypes={disabledPassTypes} />
}
