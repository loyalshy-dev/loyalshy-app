import { connection } from "next/server"
import { redirect } from "next/navigation"
import { assertAuthenticated, getRestaurantForUser } from "@/lib/dal"
import { db } from "@/lib/db"
import { getProgramsList } from "@/server/program-actions"
import { ProgramsListView } from "@/components/dashboard/programs/programs-list-view"

export default async function ProgramsPage() {
  await connection()
  const session = await assertAuthenticated()

  const restaurant = await getRestaurantForUser()
  if (!restaurant) {
    redirect("/dashboard")
  }

  const programs = await getProgramsList()

  // Compute isOwner
  let isOwner = false
  if (session.user.role === "SUPER_ADMIN") {
    isOwner = true
  } else {
    const org = await db.organization.findUnique({
      where: { slug: restaurant.slug },
      select: { id: true },
    })
    if (org) {
      const member = await db.member.findFirst({
        where: { organizationId: org.id, userId: session.user.id },
        select: { role: true },
      })
      isOwner = member?.role === "owner"
    }
  }

  return (
    <ProgramsListView
      programs={programs}
      restaurantId={restaurant.id}
      restaurantName={restaurant.name}
      isOwner={isOwner}
    />
  )
}
