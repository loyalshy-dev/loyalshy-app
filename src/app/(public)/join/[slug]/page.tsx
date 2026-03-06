import { connection } from "next/server"
import { notFound } from "next/navigation"
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

  const firstTemplate = org.templates[0]
  const title = `Join ${org.name}`
  const description = firstTemplate
    ? `Get your digital pass for ${org.name}.`
    : `Get your digital pass for ${org.name}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
  }
}

export default async function JoinPage({ params, searchParams }: PageProps) {
  await connection()
  const { slug } = await params
  const { program } = await searchParams
  const org = await getOrganizationBySlug(slug)

  if (!org) {
    notFound()
  }

  return <OnboardingForm organization={org} preselectedTemplateId={program} />
}
