import { Suspense } from "react"
import { connection } from "next/server"
import { assertAdminRole } from "@/lib/dal"
import { getAdminAuditLogs } from "@/server/admin-actions"
import { AdminAuditLogView } from "@/components/admin/audit-log/admin-audit-log-view"

async function AuditLogContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  await assertAdminRole("ADMIN_SUPPORT")

  const params = await searchParams
  const page = Number(params.page) || 1
  const search = (params.search as string) || ""
  const action = (params.action as string) || "all"
  const targetType = (params.targetType as string) || "all"

  const result = await getAdminAuditLogs({
    page,
    perPage: 25,
    search,
    action,
    targetType,
  })

  return (
    <AdminAuditLogView
      logs={result.logs}
      total={result.total}
      pageCount={result.pageCount}
      page={page}
      search={search}
      action={action}
      targetType={targetType}
    />
  )
}

export default function AuditLogPage({
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
