"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { AdminSidebar } from "./admin-sidebar"
import { AdminTopbar } from "./admin-topbar"
import { ImpersonationBanner } from "./impersonation-banner"

type AdminShellProps = {
  user: {
    name: string
    email: string
    image: string | null
    organizationId: string | null
    role: string
  }
  children: React.ReactNode
}

export function AdminShell({ user, children }: AdminShellProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-svh overflow-hidden bg-background">
        <AdminSidebar user={user} />

        <div className="flex flex-1 flex-col min-w-0">
          <ImpersonationBanner />
          <AdminTopbar />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-4 lg:px-6 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
