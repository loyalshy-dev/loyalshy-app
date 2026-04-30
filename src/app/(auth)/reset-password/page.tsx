"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useRouter } from "next/navigation"
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword")
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  // Preserved through requestPasswordReset's redirectTo. If present, send the
  // worker back to /invite/[token] after reset so they can finish accepting.
  const inviteToken = searchParams.get("invite")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t("invalidTitle")}</CardTitle>
          <CardDescription>{t("invalidDescription")}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link
            href={inviteToken ? `/forgot-password?invite=${inviteToken}` : "/forgot-password"}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("requestNewLink")}
          </Link>
        </CardFooter>
      </Card>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error(t("mismatch"))
      return
    }

    if (password.length < 8) {
      toast.error(t("tooShort"))
      return
    }

    setIsLoading(true)

    const { error } = await (authClient as unknown as {
      resetPassword: (opts: { newPassword: string; token: string }) =>
        Promise<{ error: { message: string } | null }>
    }).resetPassword({
      newPassword: password,
      token: token!,
    })

    if (error) {
      toast.error(error.message || t("failed"))
      setIsLoading(false)
      return
    }

    if (inviteToken) {
      toast.success(t("successInvite"))
      // ?reset=1 makes the invite form open in signin mode by default.
      router.push(`/invite/${inviteToken}?reset=1`)
      return
    }
    toast.success(t("success"))
    router.push("/login")
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("newPassword")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("newPasswordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t("confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <LoadingSpinner />}
            {t("submit")}
          </Button>
        </form>
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
