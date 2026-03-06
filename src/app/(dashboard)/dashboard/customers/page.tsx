import { connection } from "next/server"
import { assertAuthenticated, getOrganizationForUser } from "@/lib/dal"
import { getContacts } from "@/server/contact-actions"
import { ContactsView as CustomersView } from "@/components/dashboard/customers/customers-view"
import { db } from "@/lib/db"

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const session = await assertAuthenticated()
  const organization = await getOrganizationForUser()

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-[13px] text-muted-foreground">
        No organization found. Please contact support.
      </div>
    )
  }

  const params = await searchParams

  const search = typeof params.search === "string" ? params.search : ""
  const sort = typeof params.sort === "string" ? params.sort : "createdAt"
  const order = params.order === "asc" ? "asc" as const : "desc" as const
  const page = typeof params.page === "string" ? Math.max(1, parseInt(params.page, 10) || 1) : 1
  const hasReward = typeof params.reward === "string" ? params.reward : "all"
  const passType = typeof params.type === "string" ? params.type : "all"

  const result = await getContacts({
    page,
    perPage: 20,
    search,
    sort,
    order,
    hasReward,
    passType,
  })

  // Check if this organization has ANY contacts (for empty state)
  const totalContactCount = await db.contact.count({
    where: { organizationId: organization.id },
  })

  return (
    <CustomersView
      result={result}
      search={search}
      sort={sort}
      order={order}
      page={page}
      hasReward={hasReward}
      templateType={passType}
      isEmpty={totalContactCount === 0}
    />
  )
}
