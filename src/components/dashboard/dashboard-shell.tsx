"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, Clock, Lock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { CommandPalette } from "./command-palette"
import { MobileNav } from "./mobile-nav"
import { RegisterVisitDialog } from "./register-visit-dialog"

type DashboardShellProps = {
  user: {
    name: string
    email: string
    image: string | null
  }
  restaurant: {
    name: string
    logo: string | null
    subscriptionStatus: string
    trialEndsAt: string | null
  } | null
  orgRole: string | null
  children: React.ReactNode
}

export function DashboardShell({
  user,
  restaurant,
  orgRole,
  children,
}: DashboardShellProps) {
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
  const trialDaysRemaining = restaurant?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(restaurant.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const showTrialBanner = !trialBannerDismissed &&
    restaurant?.subscriptionStatus === "TRIALING" &&
    trialDaysRemaining !== null &&
    trialDaysRemaining <= 7

  const showPastDueBanner = !pastDueBannerDismissed &&
    restaurant?.subscriptionStatus === "PAST_DUE"

  function dismissTrialBanner() {
    setTrialBannerDismissed(true)
    try { sessionStorage.setItem("loyalshy_trial_banner_dismissed", "1") } catch {}
  }

  const showSubscriptionGate = restaurant?.subscriptionStatus === "CANCELED"

  return (
    <SidebarProvider>
      <AppSidebar user={user} restaurant={restaurant} orgRole={orgRole} />

      <SidebarInset className="min-w-0">
        <Topbar
          onOpenCommandPalette={() => setCommandOpen(true)}
          onOpenRegisterVisit={handleRegisterVisit}
        />

        {/* Subscription banners */}
        {showTrialBanner && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/5 px-4 lg:px-6 py-2.5">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""}</strong> left in your trial.{" "}
                <Link href="/dashboard/settings?tab=billing" className="underline underline-offset-2 font-medium hover:text-amber-900 dark:hover:text-amber-300">
                  Upgrade now
                </Link>
              </span>
            </div>
            <button onClick={dismissTrialBanner} className="text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300" aria-label="Dismiss trial banner">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {showPastDueBanner && (
          <div className="flex items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/5 px-4 lg:px-6 py-2.5">
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                Payment failed.{" "}
                <Link href="/dashboard/settings?tab=billing" className="underline underline-offset-2 font-medium hover:text-red-900 dark:hover:text-red-300">
                  Update your payment method
                </Link>
              </span>
            </div>
            <button onClick={() => setPastDueBannerDismissed(true)} className="text-red-600/60 hover:text-red-700 dark:text-red-400/60 dark:hover:text-red-300" aria-label="Dismiss payment banner">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto pb-[72px] md:pb-0">
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
            <div className="mx-auto w-full max-w-6xl px-4 lg:px-6 py-6">
              {children}
            </div>
          )}
        </main>

        {/* Mobile bottom nav */}
        <MobileNav onOpenRegisterVisit={handleRegisterVisit} />

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
