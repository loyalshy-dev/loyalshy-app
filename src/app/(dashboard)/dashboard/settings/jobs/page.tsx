import { connection } from "next/server"
import { assertSuperAdmin, getOrganizationForUser } from "@/lib/dal"
import { redirect } from "next/navigation"
import { getRecentJobLogs } from "@/server/jobs-actions"
import { JobsHistory } from "@/components/dashboard/settings/jobs-history"

export default async function JobsPage() {
  await connection()
  await assertSuperAdmin()

  const organization = await getOrganizationForUser()
  if (!organization) {
    redirect("/dashboard")
  }

  const { logs, total } = await getRecentJobLogs()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Background Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recent wallet pass updates and background job activity.
        </p>
      </div>

      <JobsHistory initialLogs={logs} initialTotal={total} />
    </div>
  )
}
