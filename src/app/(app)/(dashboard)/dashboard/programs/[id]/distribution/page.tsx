import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { assertAuthenticated, getOrganizationForUser, assertOrganizationRole, getOrgMember } from "@/lib/dal"
import { db } from "@/lib/db"
import { QrCodeDisplay } from "@/components/dashboard/settings/qr-code-display"
import { DirectIssueSection } from "@/components/dashboard/programs/direct-issue-section"
import { ShareLinkSection } from "@/components/dashboard/programs/distribution-share-section"
import { DistributionStats } from "@/components/dashboard/programs/distribution-stats"
import { NfcSection } from "@/components/dashboard/programs/nfc-section"
import { FirstCustomerChecklist } from "@/components/dashboard/programs/first-customer-checklist"
import { AnnouncementSection } from "@/components/dashboard/programs/announcement-section"
import { JoinModeSection } from "@/components/dashboard/programs/join-mode-section"
import { CounterMaterialSection } from "@/components/dashboard/programs/counter-material-section"
import { parseTemplateAnnouncement } from "@/lib/pass-config"
import {
  getAnnouncementQuota,
  countProgramSendsLast24h,
  ANNOUNCEMENT_PROGRAM_MAX_PER_24H,
} from "@/lib/announcement-quota"
import { PLANS, getAnnouncementUpgrade, type PlanId } from "@/lib/plans"

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

  await assertOrganizationRole(organization.id, "admin")

  // Distribution stats
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  // Run program validation and stats in parallel
  const [
    program,
    totalIssued,
    issuedThisWeek,
    eligibleContacts,
    walletHolders,
    announcementQuota,
    programSendsLast24h,
    member,
    reviewSettings,
  ] = await Promise.all([
    db.passTemplate.findFirst({
      where: { id: programId, organizationId: organization.id },
      select: {
        id: true,
        name: true,
        passType: true,
        status: true,
        joinMode: true,
        config: true,
        announcement: true,
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
    db.passInstance.count({
      where: {
        passTemplateId: programId,
        status: "ACTIVE",
        walletProvider: { not: "NONE" },
      },
    }),
    getAnnouncementQuota(db, organization),
    countProgramSendsLast24h(db, programId),
    getOrgMember(organization.id),
    // The table tent's second face asks for a Google review when a link exists
    db.googleReviewSettings.findUnique({ where: { organizationId: organization.id }, select: { reviewUrl: true } }),
  ])

  if (!program) {
    notFound()
  }

  // Invite-only programs have no public entry: the QR, the link and NFC
  // are hidden and passes come from direct issue or the staff app.
  const isPublic = program.joinMode === "PUBLIC"

  // Announcement quota: per-org plan quota + per-program Google delivery cap
  // (mirrors the server action)
  const announcement = parseTemplateAnnouncement(program.announcement)
  const plan = organization.plan as PlanId
  const announcementUpgrade = getAnnouncementUpgrade(plan)

  // Build join URL
  const origin = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? ""
  const joinPath = `/join/${organization.slug}?program=${program.id}`
  const joinUrl = origin ? `${origin}${joinPath}` : joinPath

  // Counter material: the same accent + QR logo the QR card uses, and the
  // reward in words for the card's title. Coupons print the program's own
  // name (formatCouponValue is English with a dollar sign — not for paper).
  const tDist = await getTranslations("dashboard.distribution")
  const config = program.config as Record<string, unknown> | null
  const rewardLine =
    program.passType === "COUPON"
      ? program.name
      : tDist("rewardAfterVisits", { reward: (config?.rewardDescription as string) ?? "", visits: (config?.stampsRequired as number) ?? 10 })
  const materialAccent = program.passDesign?.primaryColor ?? organization.brandColor ?? "#1a1a2e"
  const materialLogo = program.passDesign?.logoGoogleUrl ?? organization.logoGoogle ?? program.passDesign?.logoUrl ?? organization.logo ?? null

  return (
    <div className="space-y-6">
      {totalIssued === 0 ? (
        <FirstCustomerChecklist isPublic={isPublic} />
      ) : (
        <DistributionStats
          totalIssued={totalIssued}
          issuedThisWeek={issuedThisWeek}
          eligibleContacts={eligibleContacts}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <section id="join-mode-section" className="scroll-mt-6">
            <JoinModeSection templateId={program.id} joinMode={program.joinMode} />
          </section>
          {isPublic && (
            <section id="qr-section" className="scroll-mt-6">
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
            </section>
          )}
        </div>
        <div className="space-y-6">
          {isPublic && (
            <section id="share-section" className="scroll-mt-6">
              <ShareLinkSection
                joinUrl={joinUrl}
                templateName={program.name}
                organizationName={organization.name}
              />
            </section>
          )}
          <section id="direct-issue-section" className="scroll-mt-6">
            <DirectIssueSection
              templateId={program.id}
              templateName={program.name}
              passType={program.passType}
              eligibleCount={eligibleContacts}
            />
          </section>
          <section id="announcement-section" className="scroll-mt-6">
            <AnnouncementSection
              templateId={program.id}
              programActive={program.status === "ACTIVE"}
              lastAnnouncement={
                announcement
                  ? { message: announcement.message, sentAt: announcement.sentAt }
                  : null
              }
              quota={announcementQuota}
              planName={PLANS[plan].name}
              programCapReached={programSendsLast24h >= ANNOUNCEMENT_PROGRAM_MAX_PER_24H}
              upgrade={
                announcementUpgrade
                  ? { name: announcementUpgrade.name, limit: announcementUpgrade.announcementLimit }
                  : null
              }
              canManageBilling={member?.role === "owner"}
              walletHolders={walletHolders}
            />
          </section>
          {isPublic && (
            <section id="counter-material-section" className="scroll-mt-6">
              <CounterMaterialSection
                organization={{ name: organization.name, slug: organization.slug }}
                template={{ name: program.name, rewardLine, accentColor: materialAccent, qrLogoUrl: materialLogo }}
                joinUrl={joinUrl}
                reviewUrl={reviewSettings?.reviewUrl ?? null}
              />
            </section>
          )}
          {isPublic && <NfcSection joinUrl={joinUrl} />}
        </div>
      </div>

    </div>
  )
}
