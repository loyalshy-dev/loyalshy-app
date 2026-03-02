import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getRestaurantForUser, assertRestaurantRole } from "@/lib/dal"
import { db } from "@/lib/db"
import { CardDesignPreview } from "@/components/dashboard/settings/card-design-preview"

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

  const program = await db.loyaltyProgram.findFirst({
    where: { id: programId, restaurantId: restaurant.id },
    include: { cardDesign: true },
  })

  if (!program) {
    notFound()
  }

  return (
    <CardDesignPreview
      programId={programId}
      programName={program.name}
      programType={program.programType}
      programConfig={program.config}
      restaurantName={restaurant.name}
      restaurantLogo={restaurant.logo}
      restaurantLogoApple={restaurant.logoApple}
      restaurantLogoGoogle={restaurant.logoGoogle}
      visitsRequired={program.visitsRequired}
      rewardDescription={program.rewardDescription}
      cardDesign={
        program.cardDesign
          ? {
              cardType: program.cardDesign.cardType as string,
              shape: program.cardDesign.shape as string,
              primaryColor: program.cardDesign.primaryColor,
              secondaryColor: program.cardDesign.secondaryColor,
              textColor: program.cardDesign.textColor,
              patternStyle: program.cardDesign.patternStyle as string,
              progressStyle: program.cardDesign.progressStyle as string,
              labelFormat: program.cardDesign.labelFormat as string,
              customProgressLabel: program.cardDesign.customProgressLabel ?? null,
              stripImageUrl: program.cardDesign.stripImageUrl ?? null,
              editorConfig: program.cardDesign.editorConfig,
            }
          : null
      }
    />
  )
}
