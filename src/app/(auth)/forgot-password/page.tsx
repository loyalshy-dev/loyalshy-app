"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  )
}

function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword")
  const searchParams = useSearchParams()
  // When the worker came from /invite/[token] and forgot their password, we
  // round-trip the invite token through reset so they land back on the invite
  // page after setting a new password.
  const inviteToken = searchParams.get("invite")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    // Better Auth appends `?token=…` to redirectTo via URL.searchParams.set,
    // so an existing `?invite=…` query is preserved cleanly.
    const redirectTo = inviteToken
      ? `/reset-password?invite=${encodeURIComponent(inviteToken)}`
      : "/reset-password"

    const { error } = await (authClient as unknown as {
      requestPasswordReset: (opts: { email: string; redirectTo: string }) =>
        Promise<{ error: { message: string } | null }>
    }).requestPasswordReset({
      email,
      redirectTo,
    })

    if (error) {
      toast.error(error.message || t("submit"))
      setIsLoading(false)
      return
    }

    setIsSent(true)
    setIsLoading(false)
  }

  if (isSent) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t("checkEmail")}</CardTitle>
          <CardDescription>
            {t("emailSent", { email })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            {t("noEmail")}
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setIsSent(false)
              setEmail("")
            }}
          >
            {t("tryDifferent")}
          </Button>
        </CardContent>
        <CardFooter className="justify-center">
          {inviteToken ? (
            <Link href={`/invite/${inviteToken}`} className="text-sm text-muted-foreground hover:text-foreground">
              {t("backToInvite")}
            </Link>
          ) : (
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              {t("backToLogin")}
            </Link>
          )}
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
        <CardDescription>
          {t("subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <LoadingSpinner />}
            {t("submit")}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
          {t("backToLogin")}
        </Link>
      </CardFooter>
    </Card>
  )
}

function LoadingSpinner() {
  return (
    <svg
      className="size-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
