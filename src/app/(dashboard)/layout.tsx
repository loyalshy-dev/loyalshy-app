import { Suspense } from "react"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import type { Metadata } from "next"
import { getCurrentUser, getOrganizationForUser } from "@/lib/dal"
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

  // If user has no active organization, redirect to onboarding
  const activeOrgId = session.session.activeOrganizationId
  if (!activeOrgId) {
    redirect("/register?step=2")
  }

  // Fetch organization for this user
  const organization = await db.organization.findUnique({
    where: { id: activeOrgId },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      logoGoogle: true,
      plan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
    },
  })

  // Determine the user's org role
  let orgRole: string | null = null
  if (organization) {
    const member = await db.member.findFirst({
      where: { organizationId: organization.id, userId: user.id },
      select: { role: true },
    })
    orgRole = member?.role ?? null
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
      organization={
        organization
          ? {
              name: organization.name,
              logo: organization.logo,
              logoGoogle: organization.logoGoogle,
              subscriptionStatus: organization.subscriptionStatus,
              trialEndsAt: organization.trialEndsAt?.toISOString() ?? null,
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
