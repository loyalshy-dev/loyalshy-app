"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

/**
 * Client-side routing decisions for the (auth) route group. The layout
 * can't reliably know the request pathname server-side (the proxy's
 * x-pathname header doesn't survive to streamed layout renders), so the
 * server layout computes the session facts and this gate applies the
 * pathname-dependent rules:
 *
 * - Signed in WITH an org: bounce to /dashboard — except on token flows
 *   (/invite, /claim), which must stay reachable while signed in.
 * - Signed in WITHOUT an org (mid-onboarding): bounce to the org step —
 *   except on /register, /reset-password, and token flows.
 */
export function AuthRedirectGate({
  hasSession,
  hasOrg,
  children,
}: {
  hasSession: boolean
  hasOrg: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const isTokenFlow =
    pathname.startsWith("/invite") || pathname.startsWith("/claim")
  const allowsNoOrg =
    isTokenFlow ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/reset-password")

  let target: string | null = null
  if (hasSession && hasOrg && !isTokenFlow) {
    target = "/dashboard"
  } else if (hasSession && !hasOrg && !allowsNoOrg) {
    target = "/register?step=org"
  }

  useEffect(() => {
    if (target) router.replace(target)
  }, [target, router])

  if (target) return null
  return <>{children}</>
}
