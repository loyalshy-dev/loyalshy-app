import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getRestaurantForUser, assertRestaurantRole } from "@/lib/dal"
import { db } from "@/lib/db"
import { QrCodeDisplay } from "@/components/dashboard/settings/qr-code-display"

export default async function ProgramQrCodePage(props: {
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

  // Verify program belongs to this restaurant and get its details
  const program = await db.loyaltyProgram.findFirst({
    where: { id: programId, restaurantId: restaurant.id },
    select: {
      id: true,
      name: true,
      programType: true,
      config: true,
      rewardDescription: true,
      visitsRequired: true,
      cardDesign: {
        select: {
          cardType: true,
          primaryColor: true,
          secondaryColor: true,
          textColor: true,
          showStrip: true,
          patternStyle: true,
          progressStyle: true,
          labelFormat: true,
          customProgressLabel: true,
          stripImageUrl: true,
          editorConfig: true,
        },
      },
    },
  })

  if (!program) {
    notFound()
  }

  return (
    <QrCodeDisplay
      restaurant={{
        name: restaurant.name,
        slug: restaurant.slug,
        logo: restaurant.logo,
        brandColor: restaurant.brandColor,
      }}
      programs={[
        {
          id: program.id,
          name: program.name,
          programType: program.programType,
          programConfig: program.config,
          rewardDescription: program.rewardDescription,
          visitsRequired: program.visitsRequired,
          cardDesign: program.cardDesign ?? null,
        },
      ]}
    />
  )
}
