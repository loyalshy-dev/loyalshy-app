import { Suspense } from "react"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { getCurrentUser, getOrgMember } from "@/lib/dal"
import { db } from "@/lib/db"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

const DASHBOARD_NAMESPACES = ["dashboard", "studio", "serverErrors"] as const

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

  // Fetch organization and member role in parallel (getOrgMember is cached per-request)
  const [organization, member] = await Promise.all([
    db.organization.findUnique({
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
    }),
    getOrgMember(activeOrgId),
  ])

  const orgRole: string | null = member?.role ?? null

  // Provide dashboard-specific i18n namespaces (~28KB instead of full ~67KB)
  const messages = await getMessages()
  const dashboardMessages: Record<string, unknown> = {}
  for (const ns of DASHBOARD_NAMESPACES) {
    if (ns in messages) dashboardMessages[ns] = messages[ns as keyof typeof messages]
  }

  return (
    <NextIntlClientProvider messages={dashboardMessages}>
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
    </NextIntlClientProvider>
  )
}

function DashboardShellSkeleton() {
  return (
    <div className="flex h-dvh">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-[var(--sidebar-width,16rem)] flex-col border-r bg-sidebar">
        <div className="p-4 space-y-4">
          <div className="h-8 w-32 rounded-md bg-muted animate-pulse" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 rounded-md bg-muted/50 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
      {/* Main area skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b flex items-center px-4">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex-1 p-6">
          <div className="h-8 w-64 rounded bg-muted animate-pulse mb-6" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<DashboardShellSkeleton />}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  )
}
