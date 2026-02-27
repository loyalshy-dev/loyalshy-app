import { connection } from "next/server"
import { notFound } from "next/navigation"
import { assertAuthenticated, getRestaurantForUser } from "@/lib/dal"
import { getRewards, getRewardStats } from "@/server/reward-actions"
import { RewardsView } from "@/components/dashboard/rewards/rewards-view"
import { db } from "@/lib/db"

type ProgramRewardsPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ProgramRewardsPage({
  params,
  searchParams,
}: ProgramRewardsPageProps) {
  await connection()
  const { id: programId } = await params
  const sp = await searchParams
  await assertAuthenticated()

  const restaurant = await getRestaurantForUser()
  if (!restaurant) {
    notFound()
  }

  // Verify program belongs to this restaurant
  const program = await db.loyaltyProgram.findFirst({
    where: { id: programId, restaurantId: restaurant.id },
    select: { id: true, name: true },
  })
  if (!program) {
    notFound()
  }

  const tab = (sp.tab as "available" | "redeemed" | "expired") ?? "available"
  const search = (sp.search as string) ?? ""
  const sort = (sp.sort as string) ?? "earnedAt"
  const order = (sp.order as "asc" | "desc") ?? "desc"
  const page = Number(sp.page) || 1
  const dateFrom = (sp.dateFrom as string) ?? ""
  const dateTo = (sp.dateTo as string) ?? ""

  // Check if there are any rewards for this program
  const totalRewards = await db.reward.count({
    where: { enrollment: { loyaltyProgramId: programId } },
  })
  const isEmpty = totalRewards === 0

  const [result, stats] = await Promise.all([
    getRewards({ tab, page, search, sort, order, dateFrom, dateTo, programId }),
    getRewardStats(programId),
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
      programs={[]}
      selectedProgramId={programId}
      hideProgramFilter
      basePath={`/dashboard/programs/${programId}/rewards`}
    />
  )
}
