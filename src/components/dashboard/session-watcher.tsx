"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"

/**
 * Re-validates the Better Auth session whenever the browser tab regains
 * focus. If the session row is gone (e.g. an org owner removed the member
 * via Settings > Team, which now also nukes their Session rows) the user
 * is bounced to /login with `?reason=expired` so the login page can show a
 * banner instead of the user clicking around getting silent 401 redirects.
 *
 * No continuous polling — only fires when the tab actually becomes visible
 * or the window receives focus.
 */
export function SessionWatcher() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (cancelled) return
      try {
        const { data } = await authClient.getSession()
        if (!cancelled && !data) {
          router.replace("/login?reason=expired")
        }
      } catch {
        // Network blip — don't kick the user out on a transient failure.
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") check()
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [router])

  return null
}
