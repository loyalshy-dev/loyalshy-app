import { connection } from "next/server"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { assertAuthenticated, getOrganizationForUser } from "@/lib/dal"
import { getTemplatePassInstances, getTemplatePassStats } from "@/server/template-actions"
import { db } from "@/lib/db"
import { PassInstancesView } from "@/components/dashboard/programs/pass-instances-view"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TemplatePasses({ params, searchParams }: Props) {
  await connection()
  const { id: templateId } = await params
  const sp = await searchParams
  await assertAuthenticated()

  const organization = await getOrganizationForUser()
  if (!organization) notFound()

  const search = (sp.search as string) ?? ""
  const status = (sp.status as string) ?? "all"
  const page = Number(sp.page) || 1

  // Run template validation, pass instances, and stats in parallel
  const [template, result, stats] = await Promise.all([
    db.passTemplate.findFirst({
      where: { id: templateId, organizationId: organization.id },
      select: { id: true, passType: true, config: true },
    }),
    getTemplatePassInstances(templateId, {
      page,
      perPage: 20,
      search,
      status,
    }),
    getTemplatePassStats(templateId),
  ])
  if (!template) notFound()

  return (
    <PassInstancesView
      result={result}
      stats={stats}
      templateId={templateId}
      passType={template.passType}
      templateConfig={template.config}
      search={search}
      status={status}
      page={page}
    />
  )
}
