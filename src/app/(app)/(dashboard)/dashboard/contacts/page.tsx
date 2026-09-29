import { Suspense } from "react"
import { connection } from "next/server"
import { getOrganizationForUser } from "@/lib/dal"
import { getContacts } from "@/server/contact-actions"
import { ContactsView } from "@/components/dashboard/contacts/contacts-view"
import { Skeleton } from "@/components/ui/skeleton"

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()

  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-9 w-32" />
          </div>
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-[400px] rounded-lg" />
        </div>
      }
    >
      <ContactsSection searchParams={searchParams} />
    </Suspense>
  )
}

async function ContactsSection({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
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

  return (
    <ContactsView
      result={result}
      search={search}
      sort={sort}
      order={order}
      page={page}
      hasReward={hasReward}
      templateType={passType}
      isEmpty={result.total === 0}
    />
  )
}
