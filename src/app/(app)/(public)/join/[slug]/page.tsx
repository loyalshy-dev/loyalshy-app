import { connection } from "next/server"
import { notFound } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import Link from "next/link"
import { getMessages, getTranslations } from "next-intl/server"
import { getOrganizationBySlug } from "@/server/onboarding-actions"
import { OnboardingForm } from "./onboarding-form"
import type { Metadata } from "next"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ program?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const org = await getOrganizationBySlug(slug)

  if (!org) {
    return { title: "Not Found" }
  }

  return {
    title: `Join ${org.name}`,
    description: `Get your digital pass for ${org.name}.`,
    openGraph: {
      title: `Join ${org.name}`,
      description: `Get your digital pass for ${org.name}.`,
      type: "website",
    },
  }
}

const JOIN_NAMESPACES = ["common", "join"] as const

export default async function JoinPage({ params, searchParams }: PageProps) {
  await connection()
  const { slug } = await params
  const { program } = await searchParams
  const org = await getOrganizationBySlug(slug)

  if (!org) {
    notFound()
  }

  // A link or QR for an invite-only program (or a business whose programs
  // are all invite only) explains itself instead of enrolling the visitor
  // in a different program or showing a 404.
  const requestedIsPublic = program ? org.templates.some((t) => t.id === program) : true
  if (org.templates.length === 0 || !requestedIsPublic) {
    return <InviteOnlyNotice name={org.name} slug={slug} otherPrograms={org.templates.length > 0} />
  }

  const messages = await getMessages()
  const joinMessages: Record<string, unknown> = {}
  for (const ns of JOIN_NAMESPACES) {
    if (ns in messages) joinMessages[ns] = messages[ns as keyof typeof messages]
  }

  return (
    <NextIntlClientProvider messages={joinMessages}>
      <OnboardingForm organization={org} preselectedTemplateId={program} />
    </NextIntlClientProvider>
  )
}

async function InviteOnlyNotice({ name, slug, otherPrograms }: { name: string; slug: string; otherPrograms: boolean }) {
  const t = await getTranslations("join")
  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">{t("inviteOnlyTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("inviteOnlyBody", { name })}</p>
        {otherPrograms && (
          <Link href={`/join/${slug}`} className="inline-flex items-center text-sm underline underline-offset-4">
            {t("inviteOnlySeeOthers")}
          </Link>
        )}
      </div>
    </div>
  )
}
