import { Suspense } from "react"
import { connection } from "next/server"
import { assertSuperAdmin } from "@/lib/dal"
import { getAdminOrganizations } from "@/server/admin-actions"
import { AdminOrganizationsView } from "@/components/admin/organizations/admin-organizations-view"

async function OrganizationsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await connection()
  await assertSuperAdmin()

  const params = await searchParams
  const search = typeof params.search === "string" ? params.search : ""
  const sort = typeof params.sort === "string" ? params.sort : "createdAt"
  const order = params.order === "asc" ? "asc" as const : "desc" as const
  const page = params.page ? Math.max(1, parseInt(params.page)) : 1
  const filter = (
    params.filter === "ACTIVE" ||
    params.filter === "TRIALING" ||
    params.filter === "PAST_DUE" ||
    params.filter === "CANCELED"
  )
    ? params.filter
    : "all" as const

  const result = await getAdminOrganizations({
    page,
    perPage: 25,
    search,
    sort,
    order,
    filter,
  })

  return (
    <AdminOrganizationsView
      organizations={result.organizations}
      total={result.total}
      pageCount={result.pageCount}
      params={{ search, sort, order, page, filter }}
    />
  )
}

export default function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  return (
    <Suspense>
      <OrganizationsContent searchParams={searchParams} />
    </Suspense>
  )
}
