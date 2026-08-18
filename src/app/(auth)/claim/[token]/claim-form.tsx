"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Mail } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { validateHandoffToken, claimHandoff } from "@/server/handoff-actions"
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

type HandoffData = {
  organizationId: string
  organizationName: string
  organizationLogo: string | null
  expiresAt: string
}

type ValidationErrorCode = "stale_link" | "expired" | "already_used" | "rate_limited"

const CLAIM_ERROR_KEYS: Record<string, string> = {
  stale_link: "staleLinkDesc",
  expired: "expiredDesc",
  already_used: "alreadyUsedDesc",
  cannot_claim_own: "cannotClaimOwn",
  email_not_verified: "emailNotVerified",
  invalid_input: "claimFailed",
}

export function ClaimForm({ token }: { token: string }) {
  const router = useRouter()
  const t = useTranslations("auth.claim")
  const tAuth = useTranslations("auth.register")
  const [handoff, setHandoff] = useState<HandoffData | null>(null)
  const [errorCode, setErrorCode] = useState<ValidationErrorCode | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<"signup" | "verify" | "signin" | "claimAsCurrent">("signup")
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")

  useEffect(() => {
    async function validate() {
      const result = await validateHandoffToken(token)
      if ("alreadyMember" in result && result.alreadyMember) {
        toast.success(t("welcome", { organizationName: result.organizationName }))
        router.replace("/dashboard")
        return
      }
      if ("error" in result && result.error) {
        setErrorCode(result.error)
      } else if ("handoff" in result && result.handoff) {
        setHandoff(result.handoff)
        // Already signed in? Offer a one-click claim instead of making the
        // owner re-type credentials they may not remember.
        const session = await authClient.getSession()
        if (session.data?.user) {
          setSessionEmail(session.data.user.email)
          setMode("claimAsCurrent")
        }
      }
      setIsValidating(false)
    }
    validate()
  }, [token, router, t])

  async function finishClaim() {
    const result = await claimHandoff({ token })
    if ("error" in result && result.error) {
      toast.error(t(CLAIM_ERROR_KEYS[result.error] ?? "claimFailed"))
      return false
    }
    if (!("success" in result)) return false
    toast.success(t("welcome", { organizationName: result.organizationName }))
    // replace + no refresh: one-shot claim flow — refresh() would re-render
    // /claim (now "already used") before the dashboard loads.
    router.replace("/dashboard?welcome=handoff")
    return true
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!handoff) return
    setIsSubmitting(true)

    try {
      const { error } = await authClient.signUp.email({ name, email, password })
      if (error) {
        // 422 = account already exists → flip to signin with the email kept
        if (error.status === 422) {
          toast.info(t("accountExists"))
          setPassword("")
          setMode("signin")
          return
        }
        toast.error(error.message || tAuth("createFailed"))
        return
      }
      // emailOTP plugin (sendVerificationOnSignUp) mails the code
      setMode("verify")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerify(code: string) {
    if (code.length !== 6 || isSubmitting) return
    setIsSubmitting(true)

    try {
      const { error } = await authClient.emailOtp.verifyEmail({ email, otp: code })
      if (error) {
        toast.error(error.message || tAuth("verifyFailed"))
        setOtp("")
        return
      }
      await finishClaim()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResend() {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    })
    if (error) {
      toast.error(error.message || tAuth("resendFailed"))
    } else {
      toast.success(tAuth("resendSuccess"))
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!handoff) return
    setIsSubmitting(true)

    try {
      const { data, error } = await authClient.signIn.email({ email, password })
      if (error || !data) {
        toast.error(error?.message || t("invalidCredentials"))
        return
      }
      await finishClaim()
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

  if (!handoff) return null

  if (mode === "claimAsCurrent") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {t("title", { organizationName: handoff.organizationName })}
          </CardTitle>
          <CardDescription>
            {t("signedInAs", { email: sessionEmail ?? "" })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            disabled={isSubmitting}
            onClick={async () => {
              setIsSubmitting(true)
              try {
                await finishClaim()
              } finally {
                setIsSubmitting(false)
              }
            }}
          >
            {isSubmitting && <LoadingSpinner />}
            {t("claimNow")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <button
              type="button"
              className="text-foreground underline underline-offset-2 hover:no-underline"
              onClick={async () => {
                await authClient.signOut()
                setSessionEmail(null)
                setMode("signup")
              }}
            >
              {t("useDifferentAccount")}
            </button>
          </p>
        </CardContent>
      </Card>
    )
  }

  if (mode === "verify") {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-5 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold">{tAuth("verifyTitle")}</CardTitle>
          <CardDescription>{tAuth("verifySubtitle", { email })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => {
                setOtp(value)
                if (value.length === 6) handleVerify(value)
              }}
              disabled={isSubmitting}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {isSubmitting && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoadingSpinner />
              {tAuth("verifying")}
            </div>
          )}
          <p className="text-center text-sm text-muted-foreground">
            {tAuth("noCode")}{" "}
            <button
              type="button"
              className="text-foreground underline underline-offset-2 hover:no-underline"
              onClick={handleResend}
            >
              {tAuth("resendCode")}
            </button>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          {t("title", { organizationName: handoff.organizationName })}
        </CardTitle>
        <CardDescription>
          {mode === "signup" ? t("subtitleSignup") : t("subtitleSignin")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === "signup" ? (
          <form onSubmit={handleSignUp} className="space-y-4">
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
              <Label htmlFor="email">{tAuth("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={tAuth("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
              {t("createAndClaim")}
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
                placeholder={tAuth("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{tAuth("password")}</Label>
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
              {t("signInAndClaim")}
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
