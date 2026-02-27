import { connection } from "next/server"
import { assertAuthenticated, getRestaurantForUser } from "@/lib/dal"
import { getRewards, getRewardStats } from "@/server/reward-actions"
import { RewardsView } from "@/components/dashboard/rewards/rewards-view"
import { db } from "@/lib/db"

type RewardsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RewardsPage({ searchParams }: RewardsPageProps) {
  await connection()
  await assertAuthenticated()

  const params = await searchParams
  const tab = (params.tab as "available" | "redeemed" | "expired") ?? "available"
  const search = (params.search as string) ?? ""
  const sort = (params.sort as string) ?? "earnedAt"
  const order = (params.order as "asc" | "desc") ?? "desc"
  const page = Number(params.page) || 1
  const dateFrom = (params.dateFrom as string) ?? ""
  const dateTo = (params.dateTo as string) ?? ""
  const programId = (params.programId as string) ?? ""

  const restaurant = await getRestaurantForUser()
  if (!restaurant) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rewards</h1>
          <p className="text-sm text-muted-foreground mt-1">
            No restaurant found. Please set up your restaurant first.
          </p>
        </div>
      </div>
    )
  }

  // Check if there are any rewards at all (for empty state)
  const totalRewards = await db.reward.count({
    where: { restaurantId: restaurant.id },
  })
  const isEmpty = totalRewards === 0

  // Build available programs list for the program filter dropdown
  const programs = (restaurant.loyaltyPrograms ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }))

  const [result, stats] = await Promise.all([
    getRewards({ tab, page, search, sort, order, dateFrom, dateTo, programId: programId || undefined }),
    getRewardStats(programId || undefined),
  ])

  return (
    <RewardsView
      result={result}
      stats={stats}
      tab={tab}
      search={search}
      sort={sort}
      order={order}
      page={page}
      dateFrom={dateFrom}
      dateTo={dateTo}
      isEmpty={isEmpty}
      programs={programs}
      selectedProgramId={programId}
    />
  )
}
