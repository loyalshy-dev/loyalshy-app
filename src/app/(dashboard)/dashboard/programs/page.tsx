import { Suspense } from "react"
import { connection } from "next/server"
import { redirect } from "next/navigation"
import { getOrganizationForUser, getOrgMember, getCurrentUser, isAdminRole } from "@/lib/dal"
import { getTemplatesList } from "@/server/template-actions"
import { TemplatesGridView } from "@/components/dashboard/templates-grid"
import { Skeleton } from "@/components/ui/skeleton"
import { getAllowedPassTypes, ALL_PASS_TYPES, type PlanId } from "@/lib/plans"
import { COMING_SOON_PASS_TYPES } from "@/lib/feature-flags"

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
  const organization = await getOrganizationForUser()
  if (!organization) {
    redirect("/register?step=2")
  }

  // Run templates fetch, member lookup, and user check in parallel (getOrgMember and getCurrentUser are cached per-request)
  const [templates, member, currentUser] = await Promise.all([
    getTemplatesList(),
    getOrgMember(organization.id),
    getCurrentUser(),
  ])

  const isOwner = member?.role === "owner"
  const isAdmin = isAdminRole(currentUser?.user.role ?? "")
  // Admin-tier roles bypass plan pass type restrictions
  const allowedPassTypes = isAdmin
    ? ALL_PASS_TYPES
    : getAllowedPassTypes(organization.plan as PlanId)
  // Admins bypass feature flags too
  const comingSoonPassTypes = isAdmin ? [] : COMING_SOON_PASS_TYPES

  return (
    <TemplatesGridView
      templates={templates}
      organizationId={organization.id}
      organizationName={organization.name}
      organizationLogo={organization.logoApple ?? organization.logo ?? null}
      isOwner={isOwner}
      allowedPassTypes={allowedPassTypes}
      comingSoonPassTypes={comingSoonPassTypes}
    />
  )
}