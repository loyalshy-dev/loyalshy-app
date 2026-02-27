import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getRestaurantForUser, assertRestaurantRole } from "@/lib/dal"
import { getProgramForSettings } from "@/server/program-actions"
import { db } from "@/lib/db"
import { CardDesignEditor } from "@/components/dashboard/settings/card-design-editor"

export default async function ProgramDesignPage(props: {
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

  const program = await getProgramForSettings(programId)
  if (!program) {
    notFound()
  }

  // Count enrollments with wallet passes for this program
  const walletPassCount = await db.enrollment.count({
    where: {
      loyaltyProgramId: programId,
      walletPassType: { not: "NONE" },
    },
  })

  return (
    <CardDesignEditor
      restaurant={{
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        logo: restaurant.logo,
        brandColor: restaurant.brandColor,
        secondaryColor: restaurant.secondaryColor,
      }}
      programId={programId}
      cardDesign={program.cardDesign}
      walletPassCount={walletPassCount}
    />
  )
}
