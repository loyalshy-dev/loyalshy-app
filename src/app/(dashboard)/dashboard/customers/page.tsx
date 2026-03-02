import { connection } from "next/server"
import { assertAuthenticated, getRestaurantForUser } from "@/lib/dal"
import { getCustomers } from "@/server/customer-actions"
import { CustomersView } from "@/components/dashboard/customers/customers-view"
import { db } from "@/lib/db"

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const session = await assertAuthenticated()
  const restaurant = await getRestaurantForUser()

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-[13px] text-muted-foreground">
        No restaurant found. Please contact support.
      </div>
    )
  }

  const params = await searchParams

  const search = typeof params.search === "string" ? params.search : ""
  const sort = typeof params.sort === "string" ? params.sort : "createdAt"
  const order = params.order === "asc" ? "asc" as const : "desc" as const
  const page = typeof params.page === "string" ? Math.max(1, parseInt(params.page, 10) || 1) : 1
  const hasReward = typeof params.reward === "string" ? params.reward : "all"
  const programType = typeof params.type === "string" ? params.type : "all"

  const result = await getCustomers({
    page,
    perPage: 20,
    search,
    sort,
    order,
    hasReward,
    programType,
  })

  // Check if this restaurant has ANY customers (for empty state)
  const totalCustomerCount = await db.customer.count({
    where: { restaurantId: restaurant.id },
  })

  return (
    <CustomersView
      result={result}
      search={search}
      sort={sort}
      order={order}
      page={page}
      hasReward={hasReward}
      programType={programType}
      isEmpty={totalCustomerCount === 0}
    />
  )
}
