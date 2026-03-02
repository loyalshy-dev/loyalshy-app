"use client"

import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { authClient, useSession } from "@/lib/auth-client"

export function ImpersonationBanner() {
  const { data: session } = useSession()
  const router = useRouter()

  const isImpersonating = !!(session?.session as Record<string, unknown> | undefined)?.impersonatedBy

  if (!isImpersonating) return null

  async function handleStopImpersonating() {
    await authClient.admin.stopImpersonating()
    router.push("/admin/users")
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-4 lg:px-6 py-2.5">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>
          You are impersonating{" "}
          <strong>{session?.user?.name ?? "a user"}</strong>
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
        onClick={handleStopImpersonating}
      >
        Stop Impersonating
      </Button>
    </div>
  )
}
