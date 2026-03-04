import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getRestaurantForUser, assertRestaurantRole } from "@/lib/dal"
import { getProgramForSettings } from "@/server/program-actions"
import { ProgramEditor } from "@/components/dashboard/programs/program-editor"

export default async function ProgramSettingsPage(props: {
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

  return (
    <ProgramEditor
      program={program}
      restaurant={{
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        logo: restaurant.logo,
        brandColor: restaurant.brandColor,
        secondaryColor: restaurant.secondaryColor,
      }}
    />
  )
}
