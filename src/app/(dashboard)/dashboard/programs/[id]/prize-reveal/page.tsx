import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getRestaurantForUser, assertRestaurantRole } from "@/lib/dal"
import { db } from "@/lib/db"
import { PrizeRevealEditor } from "@/components/dashboard/programs/prize-reveal-editor"

export default async function PrizeRevealPage(props: {
  params: Promise<{ id: string }>
}) {
  await connection()
  const { id: programId } = await props.params
  await assertAuthenticated()

  const restaurant = await getRestaurantForUser()
  if (!restaurant) {
    redirect("/dashboard")
  }

  await assertRestaurantRole(restaurant.id, "owner")

  const program = await db.loyaltyProgram.findFirst({
    where: { id: programId, restaurantId: restaurant.id },
    select: {
      id: true,
      name: true,
      programType: true,
      config: true,
      rewardDescription: true,
      status: true,
      restaurantId: true,
    },
  })

  if (!program) {
    notFound()
  }

  if (program.programType !== "STAMP_CARD" && program.programType !== "COUPON") {
    notFound()
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <PrizeRevealEditor
        program={{
          id: program.id,
          name: program.name,
          programType: program.programType,
          config: program.config,
          rewardDescription: program.rewardDescription,
          status: program.status,
          restaurantId: program.restaurantId,
        }}
      />
    </div>
  )
}
