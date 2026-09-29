"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("auth.error")

  useEffect(() => {
    console.error("Auth error:", error)
  }, [error])

  return (
    <div className="w-full max-w-md mx-auto text-center space-y-4 py-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("message")}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground/60 font-mono">
          {t("errorId", { digest: error.digest })}
        </p>
      )}
      <div className="flex justify-center gap-3 pt-2">
        <Button onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          {t("tryAgain")}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
      </div>
    </div>
  )
}
