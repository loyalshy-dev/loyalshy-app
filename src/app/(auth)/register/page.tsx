"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
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
import { Separator } from "@/components/ui/separator"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { toast } from "sonner"
import { createOrganization } from "@/server/onboarding-registration-actions"
import {
  Check,
  ChevronRight,
  Loader2,
  Mail,
  Store,
} from "lucide-react"

// ─── Main Page Component ────────────────────────────────────

export default function RegisterPage() {
  const t = useTranslations("auth.register")
  const searchParams = useSearchParams()
  const stepParam = searchParams.get("step")

  // Google OAuth callback lands on ?step=org → jump to org step (email already verified)
  // ?step=2 for backwards compat also jumps to org
  const initialStep = stepParam === "org" || stepParam === "3" || stepParam === "2" ? 3 : 1
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [registeredEmail, setRegisteredEmail] = useState("")

  const STEPS = [
    { number: 1, label: t("stepAccount"), icon: Check },
    { number: 2, label: t("stepVerify"), icon: Mail },
    { number: 3, label: t("stepOrganization"), icon: Store },
  ] as const

  // Recover state from session on mount/refresh — handles:
  // 1. Page refresh mid-onboarding (email state lost)
  // 2. Returning unverified user (should land on verify step)
  // 3. Google OAuth callback (already verified → org step)
  const session = authClient.useSession()
  const hasRecovered = useRef(false)
  useEffect(() => {
    if (hasRecovered.current || !session.data?.user) return
    hasRecovered.current = true

    const { email, emailVerified } = session.data.user
    setRegisteredEmail(email)

    if (emailVerified) {
      // Already verified (Google user, or verified before refresh) → org step
      setCurrentStep(3)
    } else if (currentStep === 1) {
      // Authenticated but unverified — resume at verify step
      setCurrentStep(2)
    }
  }, [session.data, currentStep])

  // Sync step from URL (for Google OAuth callback)
  useEffect(() => {
    if (stepParam === "org" || stepParam === "3" || stepParam === "2") {
      setCurrentStep(3)
    }
  }, [stepParam])

  const handleAccountCreated = useCallback((email: string) => {
    setRegisteredEmail(email)
    setCurrentStep(2)
  }, [])

  const handleEmailVerified = useCallback(() => {
    setCurrentStep(3)
  }, [])

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      {currentStep > 1 && (
        <div className="flex items-center justify-center gap-1">
          {STEPS.map((step) => (
            <div key={step.number} className="flex items-center">
              <div
                className={`flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  step.number < currentStep
                    ? "bg-primary text-primary-foreground"
                    : step.number === currentStep
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step.number < currentStep ? (
                  <Check className="size-3.5" />
                ) : (
                  step.number
                )}
              </div>
              {step.number < STEPS.length && (
                <div
                  className={`mx-1 h-px w-6 ${
                    step.number < currentStep ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step content */}
      {currentStep === 1 && <AccountStep onNext={handleAccountCreated} />}
      {currentStep === 2 && (
        <VerifyEmailStep email={registeredEmail} onVerified={handleEmailVerified} />
      )}
      {currentStep === 3 && <OrganizationStep />}
    </div>
  )
}

// ─── Step 1: Account ────────────────────────────────────────

function AccountStep({ onNext }: { onNext: (email: string) => void }) {
  const t = useTranslations("auth.register")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
    })

    if (error) {
      toast.error(error.message || t("createFailed"))
      setIsLoading(false)
      return
    }

    // emailOTP plugin with sendVerificationOnSignUp: true sends the OTP automatically
    toast.success(t("accountCreated"))
    onNext(email)
  }

  async function handleGoogleSignUp() {
    setIsGoogleLoading(true)
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/register?step=org",
    })
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignUp}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? <LoadingSpinner /> : <GoogleIcon />}
          {t("continueWithGoogle")}
        </Button>

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            {t("or")}
          </span>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("fullName")}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t("fullNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
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
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("passwordHint")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            {password.length > 0 && <PasswordStrength password={password} />}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <LoadingSpinner />}
            {t("submit")}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          {t("hasAccount")}{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            {t("signIn")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}

// ─── Step 2: Verify Email ───────────────────────────────────

function VerifyEmailStep({
  email,
  onVerified,
}: {
  email: string
  onVerified: () => void
}) {
  const t = useTranslations("auth.register")
  const [otp, setOtp] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleVerify(code: string) {
    if (code.length !== 6) return
    setIsVerifying(true)

    const { error } = await authClient.emailOtp.verifyEmail({
      email,
      otp: code,
    })

    if (error) {
      toast.error(error.message || t("verifyFailed"))
      setOtp("")
      setIsVerifying(false)
      return
    }

    toast.success(t("verifySuccess"))
    onVerified()
  }

  async function handleResend() {
    setIsResending(true)

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    })

    if (error) {
      toast.error(error.message || t("resendFailed"))
    } else {
      toast.success(t("resendSuccess"))
      setCooldown(60)
    }
    setIsResending(false)
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-5 text-primary" />
        </div>
        <CardTitle className="text-xl font-bold">{t("verifyTitle")}</CardTitle>
        <CardDescription>
          {t("verifySubtitle", { email })}
        </CardDescription>
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
            disabled={isVerifying}
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

        {isVerifying && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("verifying")}
          </div>
        )}

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {t("noCode")}{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || cooldown > 0}
              className="font-medium text-foreground hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {cooldown > 0
                ? t("resendCooldown", { seconds: cooldown })
                : t("resend")}
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Step 3: Organization Name ──────────────────────────────

function OrganizationStep() {
  const t = useTranslations("auth.register")
  const router = useRouter()
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await createOrganization({ name })

      if ("error" in result && result.error) {
        toast.error(result.error)
        setIsLoading(false)
        return
      }

      if ("organizationId" in result && result.organizationId) {
        toast.success(t("allSet"))
        router.push("/dashboard")
        return
      }

      // Shouldn't reach here, but handle gracefully
      setIsLoading(false)
    } catch {
      toast.error(t("genericError"))
      setIsLoading(false)
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10">
          <Store className="size-5 text-primary" />
        </div>
        <CardTitle className="text-xl font-bold">{t("orgTitle")}</CardTitle>
        <CardDescription>
          {t("orgSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">{t("orgName")}</Label>
            <Input
              id="org-name"
              type="text"
              placeholder={t("orgPlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || !name.trim()}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
            {t("orgSubmit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Password Strength ──────────────────────────────────────

function getPasswordScore(password: string): { score: number; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 2) return { score, color: "bg-destructive" }
  if (score <= 3) return { score, color: "bg-warning" }
  if (score <= 4) return { score, color: "bg-brand" }
  return { score, color: "bg-success" }
}

function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations("auth.register")
  const { score, color } = getPasswordScore(password)

  const label =
    score <= 2
      ? t("strengthWeak")
      : score <= 3
        ? t("strengthFair")
        : score <= 4
          ? t("strengthGood")
          : t("strengthStrong")

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? color : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

// ─── Shared Components ──────────────────────────────────────

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

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
