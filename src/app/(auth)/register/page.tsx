"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
import {
  createRestaurant,
  updateRestaurantBranding,
  uploadOnboardingLogo,
  setupLoyaltyProgram,
  initializeTrialSubscription,
  completeOnboarding,
  applyCardDesignFromBrand,
} from "@/server/onboarding-registration-actions"
import {
  WalletPassRenderer,
  type WalletPassDesign,
} from "@/components/wallet-pass-renderer"
import {
  matchTemplates,
  applyPaletteToTemplate,
} from "@/lib/wallet/template-matcher"
import type { ExtractedPalette } from "@/lib/color-extraction"
import type { RestaurantCategory } from "@/lib/wallet/card-templates"
import {
  Check,
  ChevronRight,
  Upload,
  X,
  Loader2,
  Store,
  Palette,
  Gift,
  Rocket,
  PartyPopper,
  QrCode,
  Coffee,
  UtensilsCrossed,
  Smile,
  Wine,
  CakeSlice,
  Sparkles,
  ChevronDown,
} from "lucide-react"

// ─── Step definitions ───────────────────────────────────────

const STEPS = [
  { number: 1, label: "Account", icon: Check },
  { number: 2, label: "Restaurant", icon: Store },
  { number: 3, label: "Branding", icon: Palette },
  { number: 4, label: "Loyalty", icon: Gift },
  { number: 5, label: "Setup", icon: Rocket },
  { number: 6, label: "Done", icon: PartyPopper },
] as const

// ─── Main Page Component ────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stepParam = searchParams.get("step")
  const [currentStep, setCurrentStep] = useState(stepParam ? parseInt(stepParam) : 1)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null)

  // Sync step with URL
  useEffect(() => {
    const s = stepParam ? parseInt(stepParam) : 1
    if (s >= 1 && s <= 6) setCurrentStep(s)
  }, [stepParam])

  const goToStep = useCallback(
    (step: number) => {
      setCurrentStep(step)
      router.push(`/register?step=${step}`, { scroll: false })
    },
    [router]
  )

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
      {currentStep === 1 && <AccountStep onNext={() => goToStep(2)} />}
      {currentStep === 2 && (
        <RestaurantStep
          onNext={(id, slug) => {
            setRestaurantId(id)
            setRestaurantSlug(slug)
            goToStep(3)
          }}
        />
      )}
      {currentStep === 3 && restaurantId && (
        <BrandingStep
          restaurantId={restaurantId}
          onNext={() => goToStep(4)}
          onSkip={() => goToStep(4)}
        />
      )}
      {currentStep === 4 && restaurantId && (
        <LoyaltyStep
          restaurantId={restaurantId}
          onNext={() => goToStep(5)}
        />
      )}
      {currentStep === 5 && restaurantId && (
        <TrialSetupStep
          restaurantId={restaurantId}
          onNext={() => goToStep(6)}
        />
      )}
      {currentStep === 6 && restaurantId && (
        <DoneStep
          restaurantId={restaurantId}
          restaurantSlug={restaurantSlug}
        />
      )}
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

  // Check if user is already authenticated
  const session = authClient.useSession()
  useEffect(() => {
    if (session.data?.user) {
      onNext()
    }
  }, [session.data, onNext])

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

// ─── Step 2: Restaurant ─────────────────────────────────────

function RestaurantStep({
  onNext,
}: {
  onNext: (restaurantId: string, slug: string) => void
}) {
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const result = await createRestaurant({ name, address, phone })

    if ("error" in result && result.error) {
      // If already has restaurant, continue
      if (result.restaurantId) {
        onNext(result.restaurantId, "")
        return
      }
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    if ("restaurantId" in result && result.restaurantId) {
      toast.success("Restaurant created!")
      onNext(result.restaurantId, result.slug ?? "")
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10">
          <Store className="size-5 text-primary" />
        </div>
        <CardTitle className="text-xl font-bold">Tell us about your restaurant</CardTitle>
        <CardDescription>
          This information helps us set up your loyalty program.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="restaurant-name">Restaurant name *</Label>
            <Input
              id="restaurant-name"
              type="text"
              placeholder="e.g. Trattoria Bella"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="restaurant-address">Address</Label>
            <Input
              id="restaurant-address"
              type="text"
              placeholder="123 Main St, City"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="restaurant-phone">Phone</Label>
            <Input
              id="restaurant-phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <LoadingSpinner /> : <ChevronRight className="size-4" />}
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Step 3: Branding (3-phase flow) ─────────────────────────

const VIBE_OPTIONS: { id: RestaurantCategory; label: string; icon: typeof Coffee }[] = [
  { id: "cafe", label: "Cafe", icon: Coffee },
  { id: "fine-dining", label: "Fine Dining", icon: UtensilsCrossed },
  { id: "casual", label: "Casual", icon: Smile },
  { id: "bar", label: "Bar", icon: Wine },
  { id: "bakery", label: "Bakery", icon: CakeSlice },
  { id: "general", label: "General", icon: Sparkles },
]

type BrandingPhase = "input" | "processing" | "preview"

function BrandingStep({
  restaurantId,
  onNext,
  onSkip,
}: {
  restaurantId: string
  onNext: () => void
  onSkip: () => void
}) {
  const [phase, setPhase] = useState<BrandingPhase>("input")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [palette, setPalette] = useState<ExtractedPalette | null>(null)
  const [category, setCategory] = useState<RestaurantCategory | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  // Preview state
  const [currentDesign, setCurrentDesign] = useState<WalletPassDesign | null>(null)
  const [currentTemplateId, setCurrentTemplateId] = useState<string>("")
  const [currentTemplateName, setCurrentTemplateName] = useState<string>("")
  const [alternatives, setAlternatives] = useState<{ design: WalletPassDesign; templateId: string; name: string }[]>([])
  const [showManualColors, setShowManualColors] = useState(false)
  const [manualPrimary, setManualPrimary] = useState("")
  const [manualSecondary, setManualSecondary] = useState("")

  // Processing animation
  const [visibleDots, setVisibleDots] = useState(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.set("restaurantId", restaurantId)
    formData.set("file", file)

    const result = await uploadOnboardingLogo(formData)
    setIsUploading(false)

    if ("error" in result && result.error) {
      toast.error(result.error)
      return
    }

    if ("url" in result && result.url) {
      setLogoUrl(result.url)
      if ("palette" in result && result.palette) {
        setPalette(result.palette)
      }
      toast.success("Logo uploaded!")
    }
  }

  function handleGenerate() {
    if (!logoUrl && !category) {
      // Neither selected — continue with defaults
      onSkip()
      return
    }

    // Clear any lingering timers from a previous run
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    // Move to processing phase
    setPhase("processing")
    setVisibleDots(0)

    // If we have a palette, animate the color dots
    const dotCount = palette?.colors.length ?? 0
    if (dotCount > 0) {
      for (let i = 0; i < dotCount; i++) {
        const id = setTimeout(() => setVisibleDots((v) => v + 1), 200 * (i + 1))
        timersRef.current.push(id)
      }
    }

    // Run template matching (client-side, instant)
    const matches = matchTemplates(palette, category, 4)

    // Auto-transition to preview
    const delay = palette ? 1500 : 600
    const transitionId = setTimeout(() => {
      if (matches.length > 0) {
        const primary = applyPaletteToTemplate(matches[0].template, palette, category)
        setCurrentDesign(primary)
        setCurrentTemplateId(matches[0].template.id)
        setCurrentTemplateName(matches[0].template.name)
        setManualPrimary(primary.primaryColor)
        setManualSecondary(primary.secondaryColor)

        setAlternatives(
          matches.slice(1).map((m) => ({
            design: applyPaletteToTemplate(m.template, palette, category),
            templateId: m.template.id,
            name: m.template.name,
          }))
        )
      }
      setPhase("preview")
    }, delay)
    timersRef.current.push(transitionId)
  }

  function selectAlternative(idx: number) {
    const alt = alternatives[idx]
    if (!alt) return

    // Swap current with the clicked alternative
    const prevDesign = currentDesign!
    const prevId = currentTemplateId
    const prevName = currentTemplateName

    setCurrentDesign(alt.design)
    setCurrentTemplateId(alt.templateId)
    setCurrentTemplateName(alt.name)
    setManualPrimary(alt.design.primaryColor)
    setManualSecondary(alt.design.secondaryColor)

    const newAlts = [...alternatives]
    newAlts[idx] = { design: prevDesign, templateId: prevId, name: prevName }
    setAlternatives(newAlts)
  }

  function handleManualColorChange(type: "primary" | "secondary", value: string) {
    if (type === "primary") {
      setManualPrimary(value)
    } else {
      setManualSecondary(value)
    }

    if (currentDesign && /^#[0-9a-fA-F]{6}$/.test(value)) {
      const newPrimary = type === "primary" ? value : manualPrimary
      const newSecondary = type === "secondary" ? value : manualSecondary
      setCurrentDesign({
        ...currentDesign,
        primaryColor: newPrimary,
        secondaryColor: newSecondary,
        textColor: getTextColorForBg(newPrimary),
      })
    }
  }

  async function handleApplyDesign() {
    if (!currentDesign) return
    setIsApplying(true)

    const result = await applyCardDesignFromBrand({
      restaurantId,
      primaryColor: currentDesign.primaryColor,
      secondaryColor: currentDesign.secondaryColor,
      textColor: currentDesign.textColor,
      templateId: currentTemplateId || undefined,
      shape: currentDesign.shape,
      patternStyle: currentDesign.patternStyle,
      progressStyle: currentDesign.progressStyle,
      labelFormat: currentDesign.labelFormat,
      editorConfig: {
        stripColor1: currentDesign.stripColor1 ?? null,
        stripColor2: currentDesign.stripColor2 ?? null,
        stripFill: currentDesign.stripFill ?? "gradient",
        patternColor: currentDesign.patternColor ?? null,
        useStampGrid: currentDesign.useStampGrid ?? false,
        stampGridConfig: currentDesign.stampGridConfig ?? null,
      },
    })

    if ("error" in result && result.error) {
      toast.error(result.error)
      setIsApplying(false)
      return
    }

    onNext()
  }

  // ─── Phase A: Upload + Vibe ───────────────────────────────

  if (phase === "input") {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Palette className="size-5 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold">
            Make your card match your brand
          </CardTitle>
          <CardDescription>
            Upload your logo and pick your vibe — we&apos;ll generate a loyalty card for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo upload */}
          <div className="space-y-2">
            <Label>Restaurant logo</Label>
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50">
                {logoUrl ? (
                  <div className="relative size-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="size-16 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl(null)
                        setPalette(null)
                      }}
                      className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white"
                      aria-label="Remove logo"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ) : (
                  <Upload className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={isUploading}
                  />
                  <span className="text-sm font-medium text-primary hover:underline">
                    {isUploading ? "Uploading..." : logoUrl ? "Change logo" : "Upload logo"}
                  </span>
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PNG, JPEG, WebP, or SVG. Max 2MB.
                </p>
              </div>
            </div>
            {/* Show extracted colors hint */}
            {palette && palette.colors.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-xs text-muted-foreground">Colors found:</span>
                {palette.colors.slice(0, 5).map((c, i) => (
                  <div
                    key={i}
                    className="size-4 rounded-full border border-border"
                    style={{ backgroundColor: c.hex }}
                    title={`${c.hex} (${c.percentage}%)`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Vibe selector */}
          <div className="space-y-2">
            <Label>What&apos;s your restaurant&apos;s vibe?</Label>
            <div className="grid grid-cols-3 gap-2">
              {VIBE_OPTIONS.map((vibe) => {
                const Icon = vibe.icon
                const isSelected = category === vibe.id
                return (
                  <button
                    key={vibe.id}
                    type="button"
                    onClick={() => setCategory(isSelected ? null : vibe.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="size-5" />
                    <span className="text-xs font-medium">{vibe.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onSkip}
            >
              Skip for now
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleGenerate}
              disabled={isUploading}
            >
              {!logoUrl && !category ? (
                <>Continue with defaults</>
              ) : (
                <>
                  Generate my card
                  <ChevronRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Phase B: Processing ──────────────────────────────────

  if (phase === "processing") {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="size-10 animate-spin text-primary" />
            <div>
              <p className="text-lg font-semibold">
                {palette ? "Analyzing your brand..." : "Picking the perfect template..."}
              </p>
              {palette && palette.colors.length > 0 && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  {palette.colors.slice(0, 5).map((c, i) => (
                    <div
                      key={i}
                      className="size-6 rounded-full border border-border transition-all duration-300"
                      style={{
                        backgroundColor: c.hex,
                        opacity: i < visibleDots ? 1 : 0,
                        transform: i < visibleDots ? "scale(1)" : "scale(0.5)",
                      }}
                    />
                  ))}
                </div>
              )}
              {palette && visibleDots > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Found {Math.min(visibleDots, palette.colors.length)} color{visibleDots !== 1 ? "s" : ""} in your logo
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Phase C: Preview + Alternatives ──────────────────────

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-bold">Your loyalty card</CardTitle>
        <CardDescription>
          Here&apos;s a card designed for your brand. You can customize it further in the Studio later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Wallet pass preview */}
        {currentDesign && (
          <div className="flex justify-center">
            <WalletPassRenderer
              design={currentDesign}
              format="apple"
              restaurantName="Your Restaurant"
              logoUrl={logoUrl}
              width={260}
              height={357}
              compact
            />
          </div>
        )}

        {/* Alternative swatches */}
        {alternatives.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Try another look:
            </p>
            <div className="flex gap-2">
              {alternatives.map((alt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectAlternative(i)}
                  className="h-8 flex-1 rounded-md border border-border transition-all hover:scale-105 hover:shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${alt.design.primaryColor} 0%, ${alt.design.secondaryColor} 100%)`,
                  }}
                  aria-label={`Alternative template ${i + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Manual color adjustment (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowManualColors(!showManualColors)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={`size-3.5 transition-transform ${showManualColors ? "rotate-180" : ""}`}
            />
            Adjust colors manually
          </button>
          {showManualColors && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <Label className="w-20 text-xs">Primary</Label>
                <input
                  type="color"
                  value={manualPrimary}
                  onChange={(e) => handleManualColorChange("primary", e.target.value)}
                  className="size-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
                <Input
                  type="text"
                  value={manualPrimary}
                  onChange={(e) => handleManualColorChange("primary", e.target.value)}
                  className="max-w-28 font-mono text-xs h-8"
                />
              </div>
              <div className="flex items-center gap-3">
                <Label className="w-20 text-xs">Secondary</Label>
                <input
                  type="color"
                  value={manualSecondary}
                  onChange={(e) => handleManualColorChange("secondary", e.target.value)}
                  className="size-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
                <Input
                  type="text"
                  value={manualSecondary}
                  onChange={(e) => handleManualColorChange("secondary", e.target.value)}
                  className="max-w-28 font-mono text-xs h-8"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onSkip}
          >
            Skip for now
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={handleApplyDesign}
            disabled={isApplying || !currentDesign}
          >
            {isApplying ? <LoadingSpinner /> : <ChevronRight className="size-4" />}
            Use this design
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Step 4: Loyalty Program ────────────────────────────────

function LoyaltyStep({
  restaurantId,
  onNext,
}: {
  restaurantId: string
  onNext: () => void
}) {
  const [visitsRequired, setVisitsRequired] = useState(10)
  const [rewardDescription, setRewardDescription] = useState("Free meal")
  const [rewardExpiryDays, setRewardExpiryDays] = useState(90)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const result = await setupLoyaltyProgram({
      restaurantId,
      visitsRequired,
      rewardDescription,
      rewardExpiryDays,
    })

    if ("error" in result && result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    onNext()
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10">
          <Gift className="size-5 text-primary" />
        </div>
        <CardTitle className="text-xl font-bold">Set up your loyalty program</CardTitle>
        <CardDescription>
          Define how customers earn rewards at your restaurant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Visits required */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="visits-required">Visits to earn a reward</Label>
              <span className="text-sm font-semibold tabular-nums">
                {visitsRequired}
              </span>
            </div>
            <input
              id="visits-required"
              type="range"
              min={3}
              max={30}
              value={visitsRequired}
              onChange={(e) => setVisitsRequired(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>3 visits</span>
              <span>30 visits</span>
            </div>
          </div>

          {/* Reward description */}
          <div className="space-y-2">
            <Label htmlFor="reward-desc">Reward description</Label>
            <Input
              id="reward-desc"
              type="text"
              placeholder="e.g. Free coffee, 20% off, Free dessert"
              value={rewardDescription}
              onChange={(e) => setRewardDescription(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              What customers get after {visitsRequired} visits.
            </p>
          </div>

          {/* Expiry days */}
          <div className="space-y-2">
            <Label htmlFor="expiry-days">Reward expires after (days)</Label>
            <Input
              id="expiry-days"
              type="number"
              min={0}
              max={365}
              value={rewardExpiryDays}
              onChange={(e) => setRewardExpiryDays(parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Set to 0 for no expiration. Default is 90 days.
            </p>
          </div>

          {/* Preview */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Preview
            </p>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {Array.from({ length: Math.min(visitsRequired, 15) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="size-3 rounded-full bg-primary/20"
                    />
                  )
                )}
                {visitsRequired > 15 && (
                  <span className="text-xs text-muted-foreground">
                    +{visitsRequired - 15}
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm mt-2">
              After <strong>{visitsRequired}</strong> visits →{" "}
              <strong>{rewardDescription}</strong>
            </p>
            {rewardExpiryDays > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Expires {rewardExpiryDays} days after earned
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <LoadingSpinner /> : <ChevronRight className="size-4" />}
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Step 5: Trial Setup (automatic) ────────────────────────

function TrialSetupStep({
  restaurantId,
  onNext,
}: {
  restaurantId: string
  onNext: () => void
}) {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading")

  useEffect(() => {
    let cancelled = false

    async function setup() {
      const result = await initializeTrialSubscription(restaurantId)

      if (cancelled) return

      if ("error" in result && result.error) {
        setStatus("error")
        toast.error(result.error)
        return
      }

      await completeOnboarding(restaurantId)

      if (!cancelled) {
        setStatus("done")
        // Auto-advance after brief pause
        setTimeout(() => {
          if (!cancelled) onNext()
        }, 1500)
      }
    }

    setup()
    return () => {
      cancelled = true
    }
  }, [restaurantId, onNext])

  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="size-10 animate-spin text-primary" />
              <div>
                <p className="text-lg font-semibold">Setting up your account...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Creating your 14-day free trial
                </p>
              </div>
            </>
          )}
          {status === "done" && (
            <>
              <div className="flex size-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <Check className="size-6" />
              </div>
              <div>
                <p className="text-lg font-semibold">All set!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your 14-day Starter trial is ready.
                </p>
              </div>
            </>
          )}
          {status === "error" && (
            <>
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <X className="size-6" />
              </div>
              <div>
                <p className="text-lg font-semibold">Something went wrong</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Don&apos;t worry, your restaurant is set up. You can configure billing later.
                </p>
              </div>
              <Button onClick={onNext} className="mt-2">
                Continue anyway
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Step 6: Done ───────────────────────────────────────────

function DoneStep({
  restaurantId,
  restaurantSlug,
}: {
  restaurantId: string
  restaurantSlug: string | null
}) {
  const router = useRouter()
  const joinUrl = restaurantSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${restaurantSlug}`
    : null

  return (
    <Card>
      <CardContent className="py-8">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="flex size-14 items-center justify-center rounded-full bg-green-100">
            <PartyPopper className="size-7 text-green-600" />
          </div>

          <div>
            <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your restaurant is ready to welcome customers.
            </p>
          </div>

          {/* QR Code preview */}
          {joinUrl && (
            <div className="rounded-xl border bg-muted/30 p-4 w-full max-w-xs">
              <div className="flex items-center justify-center gap-2 mb-2">
                <QrCode className="size-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">
                  Your QR code link
                </p>
              </div>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {joinUrl}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Print this QR code and place it at your counter. Customize it in Settings → QR Code.
              </p>
            </div>
          )}

          {/* Quick tips */}
          <div className="w-full max-w-sm space-y-2 text-left">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Quick tips to get started
            </p>
            <div className="space-y-1.5">
              {[
                "Invite your staff from Settings → Team",
                "Print your QR code from Settings → QR Code",
                "Customize your loyalty card in Settings → Loyalty Program",
              ].map((tip) => (
                <div key={tip} className="flex items-start gap-2 text-sm">
                  <Check className="size-3.5 mt-0.5 text-green-600 shrink-0" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            size="lg"
            className="w-full max-w-xs"
            onClick={() => {
              router.push("/dashboard")
              router.refresh()
            }}
          >
            Go to Dashboard
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Text Color Helper (client-safe) ─────────────────────────

function getTextColorForBg(hex: string): string {
  const cleaned = hex.replace("#", "")
  const r = parseInt(cleaned.substring(0, 2), 16) / 255
  const g = parseInt(cleaned.substring(2, 4), 16) / 255
  const b = parseInt(cleaned.substring(4, 6), 16) / 255
  const sR = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
  const sG = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
  const sB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)
  const lum = 0.2126 * sR + 0.7152 * sG + 0.0722 * sB
  return lum > 0.179 ? "#1a1a1a" : "#ffffff"
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

  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" }
  if (score <= 3) return { score, label: "Fair", color: "bg-yellow-500" }
  if (score <= 4) return { score, label: "Good", color: "bg-blue-500" }
  return { score, label: "Strong", color: "bg-green-500" }
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
