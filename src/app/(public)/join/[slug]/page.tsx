import { connection } from "next/server"
import { notFound } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
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
