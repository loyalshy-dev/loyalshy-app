"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow, format } from "date-fns"
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Loader2,
  Monitor,
  Shield,
  ShieldOff,
  UserCog,
} from "lucide-react"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import type { AdminUserRow, AdminUserSession } from "@/server/admin-actions"
import {
  adminBanUser,
  adminUnbanUser,
  adminSetRole,
  adminRevokeAllSessions,
  adminGetUserSessions,
} from "@/server/admin-actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

type AdminUserDetailSheetProps = {
  user: AdminUserRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminUserDetailSheet({
  user,
  open,
  onOpenChange,
}: AdminUserDetailSheetProps) {
  const router = useRouter()
  const [sessions, setSessions] = useState<AdminUserSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [banReason, setBanReason] = useState("")
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!user?.id || !open) return
    setSessionsLoading(true)
    adminGetUserSessions(user.id)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false))
  }, [user?.id, open])

  if (!user) return null

  async function handleBan() {
    const formData = new FormData()
    formData.set("userId", user!.id)
    if (banReason) formData.set("banReason", banReason)

    startTransition(async () => {
      const result = await adminBanUser(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${user!.name} has been banned.`)
        setBanDialogOpen(false)
        setBanReason("")
        router.refresh()
      }
    })
  }

  async function handleUnban() {
    const formData = new FormData()
    formData.set("userId", user!.id)

    startTransition(async () => {
      const result = await adminUnbanUser(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${user!.name} has been unbanned.`)
        router.refresh()
      }
    })
  }

  async function handleSetRole() {
    const newRole = user!.role === "SUPER_ADMIN" ? "USER" : "SUPER_ADMIN"
    const formData = new FormData()
    formData.set("userId", user!.id)
    formData.set("role", newRole)

    startTransition(async () => {
      const result = await adminSetRole(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Role updated to ${newRole === "SUPER_ADMIN" ? "Super Admin" : "User"}.`)
        setRoleDialogOpen(false)
        router.refresh()
      }
    })
  }

  async function handleRevokeAll() {
    const formData = new FormData()
    formData.set("userId", user!.id)

    startTransition(async () => {
      const result = await adminRevokeAllSessions(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("All sessions revoked.")
        setSessions([])
      }
    })
  }

  async function handleImpersonate() {
    try {
      await authClient.admin.impersonateUser({ userId: user!.id })
      window.location.href = "/dashboard"
    } catch {
      toast.error("Failed to impersonate user.")
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg p-0 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Header */}
            <SheetHeader className="p-6 pb-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  <AvatarImage src={user.image ?? undefined} alt={user.name} />
                  <AvatarFallback className="text-sm">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-base truncate">
                    {user.name}
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge
                  variant="outline"
                  className={`text-[11px] ${
                    user.role === "SUPER_ADMIN"
                      ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {user.role === "SUPER_ADMIN" ? "Super Admin" : "User"}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[11px] ${
                    user.banned
                      ? "bg-destructive/10 text-destructive border-destructive/20"
                      : "bg-success/10 text-success border-success/20"
                  }`}
                >
                  {user.banned ? "Banned" : "Active"}
                </Badge>
              </div>
            </SheetHeader>

            {/* Info grid */}
            <div className="px-6 pb-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Created
                </p>
                <p className="text-sm mt-0.5">
                  {format(new Date(user.createdAt), "MMM d, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Email Verified
                </p>
                <p className="text-sm mt-0.5">
                  {user.emailVerified ? "Yes" : "No"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Restaurant
                </p>
                <p className="text-sm mt-0.5">
                  {user.restaurantName ?? "\u2014"}
                </p>
              </div>
              {user.banned && user.banReason && (
                <div className="col-span-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Ban Reason
                  </p>
                  <p className="text-sm mt-0.5 text-destructive">
                    {user.banReason}
                  </p>
                </div>
              )}
            </div>

            {/* Sessions */}
            <div className="px-6 pb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Active Sessions
                </p>
                {sessions.length > 0 && (
                  <Badge variant="outline" className="text-[11px]">
                    {sessions.length}
                  </Badge>
                )}
              </div>
              {sessionsLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading sessions...
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No active sessions.
                </p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-2.5 p-2.5 rounded-md border border-border bg-muted/30"
                    >
                      <Monitor className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] truncate">
                          {s.userAgent
                            ? s.userAgent.slice(0, 60) + (s.userAgent.length > 60 ? "..." : "")
                            : "Unknown device"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.ipAddress ?? "Unknown IP"} &middot;{" "}
                          {formatDistanceToNow(new Date(s.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pinned actions */}
          <div className="shrink-0 p-4 border-t border-border flex flex-wrap gap-2">
            {user.banned ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnban}
                disabled={isPending}
              >
                <ShieldOff className="size-3.5" />
                Unban
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBanDialogOpen(true)}
                disabled={isPending}
              >
                <Ban className="size-3.5" />
                Ban
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRoleDialogOpen(true)}
              disabled={isPending}
            >
              <Shield className="size-3.5" />
              {user.role === "SUPER_ADMIN" ? "Demote to User" : "Promote to Admin"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeAll}
              disabled={isPending || sessions.length === 0}
            >
              <KeyRound className="size-3.5" />
              Revoke Sessions
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImpersonate}
            >
              <UserCog className="size-3.5" />
              Impersonate
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban {user.name}?</DialogTitle>
            <DialogDescription>
              This will prevent the user from signing in. You can unban them later.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for ban (optional)"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBanDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBan}
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              {user.role === "SUPER_ADMIN"
                ? `Demote ${user.name} from Super Admin to regular User?`
                : `Promote ${user.name} to Super Admin? They will have full platform access.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSetRole} disabled={isPending}>
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              {user.role === "SUPER_ADMIN" ? "Demote to User" : "Promote to Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
