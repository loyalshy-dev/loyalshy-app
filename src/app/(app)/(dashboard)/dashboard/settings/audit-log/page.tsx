import { Suspense } from "react"
import { connection } from "next/server"
import { redirect } from "next/navigation"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationRole } from "@/lib/dal"
import { getOrgAuditLogs } from "@/server/org-settings-actions"
import { OrgAuditLogView } from "@/components/dashboard/settings/org-audit-log-view"

async function AuditLogContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  await assertAuthenticated()

  const organization = await getOrganizationForUser()
  if (!organization) redirect("/dashboard")
  await assertOrganizationRole(organization.id, "owner")

  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const search = (params.search as string) || ""
  const action = (params.action as string) || "all"

  const result = await getOrgAuditLogs({
    organizationId: organization.id,
    page,
    perPage: 25,
    search,
    action,
  })

  return (
    <OrgAuditLogView
      logs={result.logs}
      total={result.total}
      pageCount={result.pageCount}
      page={page}
      search={search}
      action={action}
    />
  )
}

export default function OrgAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense>
      <AuditLogContent searchParams={searchParams} />
    </Suspense>
  )
}
