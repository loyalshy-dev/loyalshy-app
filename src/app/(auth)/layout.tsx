import { Suspense } from "react"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { headers } from "next/headers"
import type { Metadata } from "next"
import { getCurrentUser } from "@/lib/dal"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

async function AuthLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()
  const session = await getCurrentUser()

  if (session) {
    // Fully onboarded user — all auth pages are irrelevant
    if (session.session.activeOrganizationId) {
      redirect("/dashboard")
    }

    // Authenticated but no organization — mid-onboarding.
    // /register is valid (they need to finish); /login and /forgot-password are not.
    const headerList = await headers()
    const pathname = headerList.get("x-pathname") || ""

    if (pathname && !pathname.startsWith("/register")) {
      redirect("/register?step=2")
    }
  }

  return children
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-4">
      <div className="w-full max-w-xl">
        <Suspense>
          <AuthLayoutInner>{children}</AuthLayoutInner>
        </Suspense>
      </div>
    </div>
  )
}
