"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { X } from "lucide-react"

const COOKIE_CONSENT_KEY = "loyalshy-cookie-consent"

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  function accept() {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg animate-in slide-in-from-bottom-4 fade-in duration-300"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div
        className="flex items-start gap-4 rounded-xl border px-5 py-4 shadow-lg backdrop-blur-lg"
        style={{
          background: "var(--mk-card, hsl(var(--card)))",
          borderColor: "var(--mk-border, hsl(var(--border)))",
        }}
      >
        <div className="flex-1 min-w-0">
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: "var(--mk-text-muted, hsl(var(--muted-foreground)))" }}
          >
            We use essential cookies for authentication and preferences. No tracking cookies.{" "}
            <Link
              href="/cookies"
              className="underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: "var(--mk-text, hsl(var(--foreground)))" }}
            >
              Learn more
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={accept}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--mk-text, hsl(var(--foreground)))" }}
          >
            Got it
          </button>
          <button
            onClick={accept}
            className="rounded-lg p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Dismiss cookie banner"
            style={{ color: "var(--mk-text-dimmed, hsl(var(--muted-foreground)))" }}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
