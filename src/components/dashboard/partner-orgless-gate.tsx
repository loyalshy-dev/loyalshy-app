"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

/**
 * Rendered by the dashboard layout when a partner rep has no active
 * organization: only the Partner console works org-less, so any other
 * dashboard route is routed there. Client-side because layouts can't
 * reliably know the request pathname server-side (the proxy's x-pathname
 * header doesn't survive to streamed layout renders).
 */
export function PartnerOrglessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const onConsole = pathname.startsWith("/dashboard/partner")

  useEffect(() => {
    if (!onConsole) router.replace("/dashboard/partner")
  }, [onConsole, router])

  if (!onConsole) return null
  return <>{children}</>
}
