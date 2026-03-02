import { Suspense } from "react"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import type { Metadata } from "next"
import { getCurrentUser, getRestaurantForUser } from "@/lib/dal"
import { db } from "@/lib/db"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

async function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()
  const session = await getCurrentUser()

  if (!session) {
    redirect("/login")
  }

  const { user } = session

  // If user has no restaurant, redirect to onboarding
  if (!user.restaurantId) {
    redirect("/register?step=2")
  }

  // Fetch restaurant for this user
  const restaurant = user.restaurantId
    ? await db.restaurant.findUnique({
        where: { id: user.restaurantId },
        select: {
          name: true,
          slug: true,
          logo: true,
          plan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
        },
      })
    : null

  // Determine the user's org role for this restaurant
  let orgRole: string | null = null
  if (restaurant) {
    const org = await db.organization.findUnique({
      where: { slug: restaurant.slug },
      select: { id: true },
    })
    if (org) {
      const member = await db.member.findFirst({
        where: { organizationId: org.id, userId: user.id },
        select: { role: true },
      })
      orgRole = member?.role ?? null
    }
  }

  // Super admins always get owner-level access
  if (user.role === "SUPER_ADMIN") {
    orgRole = "owner"
  }

  return (
    <DashboardShell
      user={{
        name: user.name,
        email: user.email,
        image: user.image,
      }}
      restaurant={
        restaurant
          ? {
              name: restaurant.name,
              logo: restaurant.logo,
              subscriptionStatus: restaurant.subscriptionStatus,
              trialEndsAt: restaurant.trialEndsAt?.toISOString() ?? null,
            }
          : null
      }
      orgRole={orgRole}
    >
      {children}
    </DashboardShell>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  )
}
