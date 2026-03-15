import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationRole } from "@/lib/dal"
import { db } from "@/lib/db"
import { QrCodeDisplay } from "@/components/dashboard/settings/qr-code-display"
import { DirectIssueSection } from "@/components/dashboard/programs/direct-issue-section"
import { CsvImportSection } from "@/components/dashboard/programs/csv-import-section"
import { ShareLinkSection } from "@/components/dashboard/programs/distribution-share-section"
import { DistributionStats } from "@/components/dashboard/programs/distribution-stats"

export default async function ProgramDistributionPage(props: {
  params: Promise<{ id: string }>
}) {
  await connection()
  const { id: programId } = await props.params
  await assertAuthenticated()

  const organization = await getOrganizationForUser()
  if (!organization) {
    redirect("/dashboard")
  }

  await assertOrganizationRole(organization.id, "owner")

  // Distribution stats
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  // Run program validation and stats in parallel
  const [program, totalIssued, issuedThisWeek, eligibleContacts] = await Promise.all([
    db.passTemplate.findFirst({
      where: { id: programId, organizationId: organization.id },
      select: {
        id: true,
        name: true,
        passType: true,
        config: true,
        passDesign: {
          select: {
            cardType: true,
            primaryColor: true,
            secondaryColor: true,
            textColor: true,
            showStrip: true,
            patternStyle: true,
            progressStyle: true,
            labelFormat: true,
            customProgressLabel: true,
            stripImageUrl: true,
            editorConfig: true,
            logoUrl: true,
            logoAppleUrl: true,
            logoGoogleUrl: true,
          },
        },
      },
    }),
    db.passInstance.count({ where: { passTemplateId: programId } }),
    db.passInstance.count({ where: { passTemplateId: programId, createdAt: { gte: weekAgo } } }),
    db.contact.count({
      where: {
        organizationId: organization.id,
        deletedAt: null,
        NOT: { passInstances: { some: { passTemplateId: programId } } },
      },
    }),
  ])

  if (!program) {
    notFound()
  }

  // Build join URL
  const origin = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? ""
  const joinPath = `/join/${organization.slug}?program=${program.id}`
  const joinUrl = origin ? `${origin}${joinPath}` : joinPath

  return (
    <div className="space-y-6">
      <DistributionStats
        totalIssued={totalIssued}
        issuedThisWeek={issuedThisWeek}
        eligibleContacts={eligibleContacts}
      />
      {/* Advisory */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <div className="text-[13px] text-muted-foreground space-y-1">
          <p>
            <strong className="text-foreground">Preventing duplicate passes:</strong>{" "}
            QR codes and links are self-service — contacts identify themselves by email or phone.
            For tighter control, use <strong>Direct Issue</strong> or <strong>CSV Import</strong> to personally create and deliver passes via email.
          </p>
          <p>
            You can also require email (instead of email or phone) in{" "}
            <a href="/dashboard/settings" className="underline underline-offset-4 hover:text-foreground">
              Settings &rarr; General &rarr; Public Join Form
            </a>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QrCodeDisplay
          organization={{
            name: organization.name,
            slug: organization.slug,
            logo: organization.logo,
            logoApple: organization.logoApple ?? null,
            logoGoogle: organization.logoGoogle ?? null,
            brandColor: organization.brandColor,
          }}
          templates={[
            {
              id: program.id,
              name: program.name,
              passType: program.passType,
              templateConfig: program.config,
              rewardDescription: (program.config as Record<string, unknown> | null)?.rewardDescription as string ?? "",
              visitsRequired: (program.config as Record<string, unknown> | null)?.stampsRequired as number ?? 10,
              cardDesign: program.passDesign ?? null,
            },
          ]}
          joinUrl={joinUrl}
        />
        <div className="space-y-6">
          <ShareLinkSection
            joinUrl={joinUrl}
            templateName={program.name}
            organizationName={organization.name}
          />
          <DirectIssueSection
            templateId={program.id}
            templateName={program.name}
            passType={program.passType}
            eligibleCount={eligibleContacts}
          />
          <CsvImportSection
            templateId={program.id}
            templateName={program.name}
          />
        </div>
      </div>

    </div>
  )
}
