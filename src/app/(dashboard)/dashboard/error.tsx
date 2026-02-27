"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard page error:", error)
  }, [error])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your restaurant at a glance.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <h2 className="text-sm font-semibold">Failed to load dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          We couldn't load your dashboard data. This is usually temporary.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono mt-2">
            Error ID: {error.digest}
          </p>
        )}
        <Button onClick={reset} size="sm" className="mt-4 gap-2">
          <RotateCcw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    </div>
  )
}
