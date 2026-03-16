import { Suspense } from "react"
import { connection } from "next/server"
import { assertAdminRole } from "@/lib/dal"
import { getAdminUsers } from "@/server/admin-actions"
import { AdminUsersView } from "@/components/admin/users/admin-users-view"

async function UsersContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await connection()
  await assertAdminRole("ADMIN_SUPPORT")

  const params = await searchParams
  const search = typeof params.search === "string" ? params.search : ""
  const sort = typeof params.sort === "string" ? params.sort : "createdAt"
  const order = params.order === "asc" ? "asc" as const : "desc" as const
  const page = params.page ? Math.max(1, parseInt(params.page)) : 1
  const filter = (params.filter === "banned" || params.filter === "super_admin" || params.filter === "admins")
    ? params.filter
    : "all" as const

  const result = await getAdminUsers({
    page,
    perPage: 25,
    search,
    sort,
    order,
    filter,
  })

  return (
    <AdminUsersView
      users={result.users}
      total={result.total}
      pageCount={result.pageCount}
      params={{ search, sort, order, page, filter }}
    />
  )
}

export default function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  return (
    <Suspense>
      <UsersContent searchParams={searchParams} />
    </Suspense>
  )
}
