"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import {
  validateInvitationToken,
  acceptStaffInvitation,
  signUpAndAcceptInvite,
} from "@/server/auth-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

type InvitationData = {
  id: string
  email: string
  role: string
  organizationName: string
  organizationId: string
  expiresAt: string
}

type ValidationErrorCode = "stale_link" | "expired" | "already_used" | "rate_limited"

export function InviteForm({ token }: { token: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("auth.invite")
  const tAuth = useTranslations("auth.register")
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [errorCode, setErrorCode] = useState<ValidationErrorCode | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Default to signin when returning from a password reset (?reset=1) so the
  // worker doesn't have to flip the form themselves.
  const [mode, setMode] = useState<"signup" | "signin">(
    searchParams.get("reset") === "1" ? "signin" : "signup",
  )
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    async function validate() {
      const result = await validateInvitationToken(token)
      if ("alreadyMember" in result && result.alreadyMember) {
        // Logged-in user re-clicked their own already-accepted invite.
        // Skip the form entirely and route them straight to the dashboard.
        toast.success(
          t("welcome", { organizationName: result.organizationName }),
        )
        router.replace("/dashboard")
        return
      }
      if ("error" in result && result.error) {
        // Map known error codes; the rate-limit branch returns a free-form
        // "Too many requests..." string so we collapse anything unknown
        // into the rate-limit slot.
        const known: ValidationErrorCode[] = [
          "stale_link",
          "expired",
          "already_used",
        ]
        const code = (known as string[]).includes(result.error)
          ? (result.error as ValidationErrorCode)
          : "rate_limited"
        setErrorCode(code)
      } else if ("invitation" in result && result.invitation) {
        setInvitation(result.invitation)
      }
      setIsValidating(false)
    }
    validate()
  }, [token, router, t])

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!invitation) return
    setIsSubmitting(true)

    try {
      // Single server action that creates user + account + member + session
      // with emailVerified: true. Bypasses Better Auth's /sign-up/email so
      // the emailOTP plugin doesn't fire a junk verification email — the
      // invitation email itself is proof of address ownership.
      const result = await signUpAndAcceptInvite({ token, name, password })

      if ("error" in result) {
        if (result.alreadyExists) {
          toast.info(t("accountExists"))
          setPassword("")
          setMode("signin")
          return
        }
        toast.error(result.error)
        return
      }

      toast.success(t("welcome", { organizationName: invitation.organizationName }))
      // replace + no refresh: we're navigating away from a one-shot accept
      // flow, and refresh() would re-render /invite (now showing "already
      // accepted") before the dashboard loads.
      router.replace("/dashboard")
    } catch (err) {
      console.error("Invite signup failed:", err)
      toast.error(err instanceof Error ? err.message : t("createFailed"))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!invitation) return
    setIsSubmitting(true)

    // Track which leg is in flight: if signin succeeded but accept threw
    // (DB blip / transient error), the user is now signed-in-to-nothing.
    // We surface a specific "signed in, retry" message instead of the
    // generic "invalid credentials" so they understand pressing the
    // button again will recover (acceptStaffInvitation is idempotent).
    let didSignIn = false

    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email: invitation.email,
        password,
      })

      if (signInError || !data) {
        toast.error(signInError?.message || t("invalidCredentials"))
        return
      }
      didSignIn = true

      const acceptResult = await acceptStaffInvitation({ token })
      if (acceptResult.error) {
        toast.error(acceptResult.error)
        return
      }

      toast.success(t("welcome", { organizationName: invitation.organizationName }))
      router.replace("/dashboard")
    } catch (err) {
      console.error("Invite signin failed:", err)
      if (didSignIn) {
        toast.error(t("acceptFailedTryAgain"))
      } else {
        toast.error(err instanceof Error ? err.message : t("invalidCredentials"))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isValidating) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner />
          <span className="ml-2 text-muted-foreground">{t("validating")}</span>
        </CardContent>
      </Card>
    )
  }

  if (errorCode) {
    const titleKey =
      errorCode === "already_used"
        ? "alreadyUsedTitle"
        : errorCode === "expired"
          ? "expiredTitle"
          : errorCode === "rate_limited"
            ? "rateLimitedTitle"
            : "staleLinkTitle"
    const descKey =
      errorCode === "already_used"
        ? "alreadyUsedDesc"
        : errorCode === "expired"
          ? "expiredDesc"
          : errorCode === "rate_limited"
            ? "rateLimitedDesc"
            : "staleLinkDesc"
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t(titleKey)}</CardTitle>
          <CardDescription>{t(descKey)}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button variant="outline" onClick={() => router.push("/login")}>
            {t("goToSignIn")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!invitation) return null

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">{t("joinOrg", { organizationName: invitation.organizationName })}</CardTitle>
        <CardDescription>
          {t("invitedAs", { role: invitation.role === "OWNER" ? "an owner" : "a staff member" })}{" "}
          {mode === "signup"
            ? t("createAccount")
            : t("signInToAccept")}
        </CardDescription>
        <ExpiryHint expiresAt={invitation.expiresAt} />
      </CardHeader>
      <CardContent>
        {mode === "signup" ? (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{tAuth("email")}</Label>
              <Input
                id="email"
                type="email"
                value={invitation.email}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{tAuth("fullName")}</Label>
              <Input
                id="name"
                type="text"
                placeholder={tAuth("fullNamePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{tAuth("password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={tAuth("passwordHint")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <LoadingSpinner />}
              {t("createAndJoin")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t("hasAccount")}{" "}
              <button
                type="button"
                className="text-foreground underline underline-offset-2 hover:no-underline"
                onClick={() => { setPassword(""); setMode("signin") }}
              >
                {t("signInInstead")}
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{tAuth("email")}</Label>
              <Input
                id="email"
                type="email"
                value={invitation.email}
                disabled
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{tAuth("password")}</Label>
                <Link
                  href={`/forgot-password?invite=${encodeURIComponent(token)}`}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder={tAuth("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <LoadingSpinner />}
              {t("signInAndJoin")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t("noAccount")}{" "}
              <button
                type="button"
                className="text-foreground underline underline-offset-2 hover:no-underline"
                onClick={() => { setPassword(""); setMode("signup") }}
              >
                {t("createOne")}
              </button>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function ExpiryHint({ expiresAt }: { expiresAt: string }) {
  const t = useTranslations("auth.invite")
  const expiry = new Date(expiresAt)
  const now = new Date()
  const ms = expiry.getTime() - now.getTime()
  if (ms <= 0) return null
  const hours = Math.floor(ms / 3_600_000)
  const days = Math.floor(hours / 24)
  // < 24h shows hours so a "1-day-left" notice doesn't lie about the actual
  // window. ICU plurals handle the en/es/fr conjugation in the messages file.
  const text =
    days >= 1
      ? t("expiresInDays", { count: days })
      : t("expiresInHours", { count: Math.max(hours, 0) })
  return (
    <p className="mt-2 text-xs text-muted-foreground">{text}</p>
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
