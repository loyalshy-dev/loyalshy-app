import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationRole } from "@/lib/dal"
import { db } from "@/lib/db"
import { QrCodeDisplay } from "@/components/dashboard/settings/qr-code-display"
import { DirectIssueSection } from "@/components/dashboard/programs/direct-issue-section"
import { CsvImportSection } from "@/components/dashboard/programs/csv-import-section"
import { ShareLinkSection } from "@/components/dashboard/programs/distribution-share-section"
import { DistributionStats } from "@/components/dashboard/programs/distribution-stats"
import { JoinModeToggle } from "@/components/dashboard/programs/join-mode-toggle"
import { EmbedSnippetSection } from "@/components/dashboard/programs/embed-snippet-section"

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
        joinMode: true,
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

  const isOpen = program.joinMode === "OPEN"

  return (
    <div className="space-y-6">
      <JoinModeToggle
        organizationId={organization.id}
        templateId={program.id}
        initialJoinMode={program.joinMode}
      />

      <DistributionStats
        totalIssued={totalIssued}
        issuedThisWeek={issuedThisWeek}
        eligibleContacts={eligibleContacts}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR code + share link only for OPEN programs */}
        {isOpen && (
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
        )}
        <div className="space-y-6">
          {isOpen && (
            <ShareLinkSection
              joinUrl={joinUrl}
              templateName={program.name}
              organizationName={organization.name}
            />
          )}
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
          {program.passType === "BUSINESS_CARD" && isOpen && (
            <EmbedSnippetSection
              joinUrl={joinUrl}
              organizationName={organization.name}
              templateName={program.name}
            />
          )}
        </div>
      </div>

    </div>
  )
}
