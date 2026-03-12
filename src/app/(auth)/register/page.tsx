"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
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
import { toast } from "sonner"
import { createOrganization } from "@/server/onboarding-registration-actions"
import {
  Check,
  ChevronRight,
  Loader2,
  Store,
} from "lucide-react"

// ─── Step definitions ───────────────────────────────────────

const STEPS = [
  { number: 1, label: "Account", icon: Check },
  { number: 2, label: "Organization", icon: Store },
] as const

// ─── Main Page Component ────────────────────────────────────

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const stepParam = searchParams.get("step")
  const [currentStep, setCurrentStep] = useState(stepParam === "2" ? 2 : 1)

  // Sync step from URL (for Google OAuth callback to ?step=2)
  useEffect(() => {
    if (stepParam === "2") setCurrentStep(2)
  }, [stepParam])

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
      {currentStep === 1 && <AccountStep onNext={() => setCurrentStep(2)} />}
      {currentStep === 2 && <OrganizationStep />}
    </div>
  )
}

// ─── Step 1: Account ────────────────────────────────────────

function AccountStep({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const onNextRef = useRef(onNext)
  onNextRef.current = onNext

  // Check if user is already authenticated
  const session = authClient.useSession()
  useEffect(() => {
    if (session.data?.user) {
      onNextRef.current()
    }
  }, [session.data])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
    })

    if (error) {
      toast.error(error.message || "Failed to create account")
      setIsLoading(false)
      return
    }

    toast.success("Account created!")
    onNext()
  }

  async function handleGoogleSignUp() {
    setIsGoogleLoading(true)
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/register?step=2",
    })
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>Get started with Loyalshy for free</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignUp}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? <LoadingSpinner /> : <GoogleIcon />}
          Continue with Google
        </Button>

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            or
          </span>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
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
            Create account
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}

// ─── Step 2: Organization Name ──────────────────────────────

function OrganizationStep() {
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
        toast.success("You're all set!")
        router.push("/dashboard")
        return
      }

      // Shouldn't reach here, but handle gracefully
      setIsLoading(false)
    } catch {
      toast.error("Something went wrong. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10">
          <Store className="size-5 text-primary" />
        </div>
        <CardTitle className="text-xl font-bold">Name your organization</CardTitle>
        <CardDescription>
          You can update this and add more details later in settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization name</Label>
            <Input
              id="org-name"
              type="text"
              placeholder="e.g. Trattoria Bella"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || !name.trim()}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
            Get started
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Password Strength ──────────────────────────────────────

function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 2) return { score, label: "Weak", color: "bg-destructive" }
  if (score <= 3) return { score, label: "Fair", color: "bg-warning" }
  if (score <= 4) return { score, label: "Good", color: "bg-brand" }
  return { score, label: "Strong", color: "bg-success" }
}

function PasswordStrength({ password }: { password: string }) {
  const { score, label, color } = getPasswordStrength(password)

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
