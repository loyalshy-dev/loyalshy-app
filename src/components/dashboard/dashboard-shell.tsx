"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import dynamic from "next/dynamic"
import { AlertTriangle, Clock, Lock, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { MobileNav } from "./mobile-nav"

const CommandPalette = dynamic(() => import("./command-palette").then(m => ({ default: m.CommandPalette })), { ssr: false })
const RegisterVisitDialog = dynamic(() => import("./register-visit-dialog").then(m => ({ default: m.RegisterVisitDialog })), { ssr: false })

type DashboardShellProps = {
  user: {
    name: string
    email: string
    image: string | null
  }
  organization: {
    name: string
    logo: string | null
    logoGoogle: string | null
    subscriptionStatus: string
    trialEndsAt: string | null
  } | null
  orgRole: string | null
  children: React.ReactNode
}

export function DashboardShell({
  user,
  organization,
  orgRole,
  children,
}: DashboardShellProps) {
  const t = useTranslations("dashboard.shell")
  const [commandOpen, setCommandOpen] = useState(false)
  const [registerVisitOpen, setRegisterVisitOpen] = useState(false)
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false
    return sessionStorage.getItem("loyalshy_trial_banner_dismissed") === "1"
  })
  // Past due banner should never be persistently dismissed — it's urgent
  const [pastDueBannerDismissed, setPastDueBannerDismissed] = useState(false)

  function handleRegisterVisit() {
    setCommandOpen(false)
    setRegisterVisitOpen(true)
  }

  // Compute trial days remaining
  const trialDaysRemaining = organization?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(organization.trialEndsAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const showTrialBanner = !trialBannerDismissed &&
    organization?.subscriptionStatus === "TRIALING" &&
    trialDaysRemaining !== null &&
    trialDaysRemaining <= 7

  const showPastDueBanner = !pastDueBannerDismissed &&
    organization?.subscriptionStatus === "PAST_DUE"

  function dismissTrialBanner() {
    setTrialBannerDismissed(true)
    try { sessionStorage.setItem("loyalshy_trial_banner_dismissed", "1") } catch {}
  }

  const showSubscriptionGate = organization?.subscriptionStatus === "CANCELED"
  const pathname = usePathname()
  const isStudioPage = pathname.endsWith("/design")

  return (
    <SidebarProvider>
      <AppSidebar user={user} organization={organization} orgRole={orgRole} />

      <SidebarInset className="min-w-0">
        {/* Hide topbar on mobile when in studio/design to maximize canvas space */}
        <div className={isStudioPage ? "hidden md:block" : ""}>
          <Topbar
            onOpenCommandPalette={() => setCommandOpen(true)}
            onOpenRegisterVisit={handleRegisterVisit}
          />
        </div>

        {/* Subscription banners — hidden on mobile for studio */}
        {showTrialBanner && (
          <div className={`flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/5 px-4 lg:px-6 py-2.5${isStudioPage ? " hidden md:flex" : ""}`}>
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t("trialDaysLeft", { count: trialDaysRemaining ?? 0 })}{" "}
                <Link href="/dashboard/settings?tab=billing" className="underline underline-offset-2 font-medium hover:text-amber-900 dark:hover:text-amber-300">
                  {t("upgradeNow")}
                </Link>
              </span>
            </div>
            <button onClick={dismissTrialBanner} className="text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300" aria-label={t("dismissBanner")}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {showPastDueBanner && (
          <div className={`flex items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/5 px-4 lg:px-6 py-2.5${isStudioPage ? " hidden md:flex" : ""}`}>
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t("pastDue")}{" "}
                <Link href="/dashboard/settings?tab=billing" className="underline underline-offset-2 font-medium hover:text-red-900 dark:hover:text-red-300">
                  {t("updateBilling")}
                </Link>
              </span>
            </div>
            <button onClick={() => setPastDueBannerDismissed(true)} className="text-red-600/60 hover:text-red-700 dark:text-red-400/60 dark:hover:text-red-300" aria-label="Dismiss payment banner">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <main className={`flex-1 overflow-y-auto md:pb-0 ${isStudioPage ? "pb-0" : "pb-18"}`}>
          {showSubscriptionGate ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <Lock className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight">
                Your subscription has ended
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Your subscription was canceled. Upgrade to a plan to continue
                using Loyalshy and access your dashboard.
              </p>
              <Button asChild className="mt-6">
                <Link href="/dashboard/settings?tab=billing">
                  Choose a plan
                </Link>
              </Button>
            </div>
          ) : (
            <div className={isStudioPage ? "w-full px-0 py-0 md:px-4 lg:px-6 md:py-6" : "w-full px-4 lg:px-6 py-6"}>
              {children}
            </div>
          )}
        </main>

        {/* Mobile bottom nav — hidden on studio/design page (has its own toolbar) */}
        {!isStudioPage && (
          <MobileNav
            onOpenRegisterVisit={handleRegisterVisit}
            onOpenMore={() => setCommandOpen(true)}
          />
        )}

        {/* Command palette */}
        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          onRegisterVisit={handleRegisterVisit}
        />

        {/* Register Visit dialog */}
        <RegisterVisitDialog
          open={registerVisitOpen}
          onOpenChange={setRegisterVisitOpen}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
