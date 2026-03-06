import { Suspense } from "react"
import { connection } from "next/server"
import { redirect } from "next/navigation"
import { assertAuthenticated, getOrganizationForUser } from "@/lib/dal"
import { getTemplatesList } from "@/server/template-actions"
import { getOnboardingChecklist } from "@/server/onboarding-registration-actions"
import { db } from "@/lib/db"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"
import { TemplatesGridView } from "@/components/dashboard/templates-grid"
import { Skeleton } from "@/components/ui/skeleton"

export default async function OverviewPage() {
  await connection()
  await assertAuthenticated()

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <OnboardingChecklistSection />
      </Suspense>

      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-9 w-32" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-85 rounded-lg" />
              <Skeleton className="h-85 rounded-lg" />
              <Skeleton className="h-85 rounded-lg" />
            </div>
          </div>
        }
      >
        <TemplatesGridSection />
      </Suspense>
    </div>
  )
}

async function TemplatesGridSection() {
  const session = await assertAuthenticated()
  const organization = await getOrganizationForUser()
  if (!organization) {
    redirect("/register?step=2")
  }

  const templates = await getTemplatesList()

  let isOwner = false
  if (session.user.role === "SUPER_ADMIN") {
    isOwner = true
  } else {
    const member = await db.member.findFirst({
      where: { organizationId: organization.id, userId: session.user.id },
      select: { role: true },
    })
    isOwner = member?.role === "owner"
  }

  return (
    <TemplatesGridView
      templates={templates}
      organizationId={organization.id}
      organizationName={organization.name}
      isOwner={isOwner}
    />
  )
}

async function OnboardingChecklistSection() {
  const organization = await getOrganizationForUser()
  if (!organization) return null

  const data = await getOnboardingChecklist(organization.id)
  if (data.isDismissed) return null

  return <OnboardingChecklist organizationId={organization.id} data={data} />
}
