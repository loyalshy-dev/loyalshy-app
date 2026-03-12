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
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[600px] rounded-full bg-brand/[0.06] blur-[120px] dark:bg-brand/[0.1]" />

      <div className="relative z-10 w-full max-w-xl">
        <Suspense>
          <AuthLayoutInner>{children}</AuthLayoutInner>
        </Suspense>
      </div>
    </div>
  )
}
