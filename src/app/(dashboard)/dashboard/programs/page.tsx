import { Suspense } from "react"
import { connection } from "next/server"
import { redirect } from "next/navigation"
import { getCurrentUser, getOrganizationForUser } from "@/lib/dal"
import { getTemplatesList } from "@/server/template-actions"
import { db } from "@/lib/db"
import { TemplatesGridView } from "@/components/dashboard/templates-grid"
import { Skeleton } from "@/components/ui/skeleton"

export default async function ProgramsPage() {
  await connection()

  return (
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
      <ProgramsSection />
    </Suspense>
  )
}

async function ProgramsSection() {
  const session = await getCurrentUser()
  const organization = await getOrganizationForUser()
  if (!organization || !session) {
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
      organizationLogo={organization.logoApple ?? organization.logo ?? null}
      isOwner={isOwner}
    />
  )
}