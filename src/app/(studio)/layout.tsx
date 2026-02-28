import { Suspense } from "react"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import type { Metadata } from "next"
import { getCurrentUser } from "@/lib/dal"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

async function StudioLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()
  const session = await getCurrentUser()

  if (!session) {
    redirect("/login")
  }

  if (!session.user.restaurantId) {
    redirect("/register?step=2")
  }

  return <>{children}</>
}

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense>
      <StudioLayoutInner>{children}</StudioLayoutInner>
    </Suspense>
  )
}
