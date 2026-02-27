import { connection } from "next/server"
import { notFound } from "next/navigation"
import { getRestaurantBySlug } from "@/server/onboarding-actions"
import { OnboardingForm } from "./onboarding-form"
import type { Metadata } from "next"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ program?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const restaurant = await getRestaurantBySlug(slug)

  if (!restaurant) {
    return { title: "Not Found" }
  }

  // Use the first active program for metadata description
  const firstProgram = restaurant.programs[0]
  const title = `Join ${restaurant.name}`
  const description = firstProgram
    ? `Get your digital loyalty card for ${restaurant.name}. Earn a free ${firstProgram.rewardDescription} after ${firstProgram.visitsRequired} visits!`
    : `Get your digital loyalty card for ${restaurant.name}.`

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
  const restaurant = await getRestaurantBySlug(slug)

  if (!restaurant) {
    notFound()
  }

  return <OnboardingForm restaurant={restaurant} preselectedProgramId={program} />
}
