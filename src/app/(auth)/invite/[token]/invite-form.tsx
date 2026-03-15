"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { validateInvitationToken, acceptStaffInvitation } from "@/server/auth-actions"
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
}

export function InviteForm({ token }: { token: string }) {
  const router = useRouter()
  const t = useTranslations("auth.invite")
  const tAuth = useTranslations("auth.register")
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<"signup" | "signin">("signup")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    async function validate() {
      const result = await validateInvitationToken(token)
      if (result.error) {
        setError(result.error)
      } else if (result.invitation) {
        setInvitation(result.invitation)
      }
      setIsValidating(false)
    }
    validate()
  }, [token])

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!invitation) return
    setIsSubmitting(true)

    // Create account via Better Auth
    const { data, error: signUpError } = await authClient.signUp.email({
      name,
      email: invitation.email,
      password,
    })

    if (signUpError || !data) {
      toast.error(signUpError?.message || t("createFailed"))
      setIsSubmitting(false)
      return
    }

    // Accept the invitation (link user to organization)
    const acceptResult = await acceptStaffInvitation({
      token,
    })

    if (acceptResult.error) {
      toast.error(acceptResult.error)
      setIsSubmitting(false)
      return
    }

    toast.success(t("welcome", { organizationName: invitation.organizationName }))
    router.push("/dashboard")
    router.refresh()
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!invitation) return
    setIsSubmitting(true)

    const { data, error: signInError } = await authClient.signIn.email({
      email: invitation.email,
      password,
    })

    if (signInError || !data) {
      toast.error(signInError?.message || t("invalidCredentials"))
      setIsSubmitting(false)
      return
    }

    const acceptResult = await acceptStaffInvitation({
      token,
    })

    if (acceptResult.error) {
      toast.error(acceptResult.error)
      setIsSubmitting(false)
      return
    }

    toast.success(t("welcome", { organizationName: invitation.organizationName }))
    router.push("/dashboard")
    router.refresh()
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

  if (error) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t("invalid")}</CardTitle>
          <CardDescription>{error}</CardDescription>
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
