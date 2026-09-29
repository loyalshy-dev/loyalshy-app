import { Suspense } from "react"
import { connection } from "next/server"
import { assertAdminRole } from "@/lib/dal"
import { getCohortRetention } from "@/server/cohort-actions"
import { CohortRetentionView } from "@/components/admin/cohorts/cohort-retention-view"

async function CohortsContent() {
  await connection()
  await assertAdminRole("ADMIN_SUPPORT")

  const segments = await getCohortRetention()
  if ("error" in segments) {
    return null
  }

  return <CohortRetentionView segments={segments} />
}

export default function AdminCohortsPage() {
  return (
    <Suspense>
      <CohortsContent />
    </Suspense>
  )
}
