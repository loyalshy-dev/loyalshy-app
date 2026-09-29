"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Studio error:", error.digest ?? error.message)
  }, [error])

  return (
    <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 400, padding: 24 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            backgroundColor: "var(--destructive-foreground)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <AlertTriangle style={{ width: 20, height: 20, color: "var(--destructive)" }} />
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
          Failed to load studio
        </h2>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 16 }}>
          We couldn&apos;t load the design editor. This is usually temporary.
        </p>
        {error.digest && (
          <p style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace", marginBottom: 16 }}>
            Error ID: {error.digest}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Link
            href="/dashboard/programs"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              fontSize: 13,
              color: "var(--foreground)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back
          </Link>
          <button
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <RotateCcw style={{ width: 14, height: 14 }} />
            Retry
          </button>
        </div>
      </div>
    </div>
  )
}
