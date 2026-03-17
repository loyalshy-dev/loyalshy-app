import { Suspense } from "react"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { headers } from "next/headers"
import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { getCurrentUser } from "@/lib/dal"
import { db } from "@/lib/db"

const AUTH_NAMESPACES = ["common", "auth", "nav"] as const

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
    // Check if user has an org — either via session or by membership lookup
    let hasOrg = !!session.session.activeOrganizationId

    if (!hasOrg) {
      // Session lost activeOrganizationId (e.g., new session after password reset).
      // Check if user actually has an org membership and restore it.
      const membership = await db.member.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
        orderBy: { createdAt: "asc" },
      })

      if (membership) {
        // Restore activeOrganizationId on all active sessions
        await db.session.updateMany({
          where: { userId: session.user.id },
          data: { activeOrganizationId: membership.organizationId },
        })
        hasOrg = true
      }
    }

    if (hasOrg) {
      redirect("/dashboard")
    }

    // Authenticated but no organization — mid-onboarding.
    // /register is valid (they need to finish); /login and /forgot-password are not.
    const headerList = await headers()
    const pathname = headerList.get("x-pathname") || ""

    if (pathname && !pathname.startsWith("/register") && !pathname.startsWith("/reset-password")) {
      redirect("/register?step=org")
    }
  }

  return children
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const messages = await getMessages()
  const authMessages: Record<string, unknown> = {}
  for (const ns of AUTH_NAMESPACES) {
    if (ns in messages) authMessages[ns] = messages[ns as keyof typeof messages]
  }

  return (
    <NextIntlClientProvider messages={authMessages}>
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-muted p-4">
      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* Radial fade so the grid dissolves at edges */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, transparent 0%, var(--color-muted) 100%)",
        }}
      />
      {/* Brand glow behind the card */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-125 w-150 rounded-full bg-brand/6 blur-[120px] dark:bg-brand/10" />

      <div className="relative z-10 w-full max-w-xl">
        <Suspense>
          <AuthLayoutInner>{children}</AuthLayoutInner>
        </Suspense>
      </div>
    </div>
    </NextIntlClientProvider>
  )
}
