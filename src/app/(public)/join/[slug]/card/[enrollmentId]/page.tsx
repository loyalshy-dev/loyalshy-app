import { connection } from "next/server"
import { notFound } from "next/navigation"
import { verifyCardSignature } from "@/lib/card-access"
import { getPassInstanceCardData } from "@/server/onboarding-actions"
import { CardPageClient } from "./card-page-client"
import type { Metadata } from "next"

type PageProps = {
  params: Promise<{ slug: string; enrollmentId: string }>
  searchParams: Promise<{ sig?: string }>
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const { sig } = await searchParams

  if (!sig) return { title: "Access Denied" }

  return {
    title: `My Pass`,
    description: `View your digital pass`,
    robots: { index: false, follow: false },
  }
}

export default async function CardPage({ params, searchParams }: PageProps) {
  await connection()
  const { slug, enrollmentId } = await params
  const { sig } = await searchParams

  // Verify HMAC signature
  if (!sig || !verifyCardSignature(enrollmentId, sig)) {
    notFound()
  }

  // Fetch pass instance data
  const data = await getPassInstanceCardData(enrollmentId, slug)
  if (!data) {
    notFound()
  }

  return (
    <CardPageClient
      data={data}
      passInstanceId={enrollmentId}
      organizationSlug={slug}
      signature={sig}
    />
  )
}
