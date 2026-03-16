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
import { useTranslations } from "next-intl"
import { authClient } from "@/lib/auth-client"
import type { AdminUserRow, AdminUserSession } from "@/server/admin-actions"
import {
  adminBanUser,
  adminUnbanUser,
  adminSetRole,
  adminRevokeAllSessions,
  adminGetUserSessions,
  adminImpersonateUser,
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

const ROLE_LABELS: Record<string, string> = {
  USER: "user",
  ADMIN_SUPPORT: "adminSupport",
  ADMIN_BILLING: "adminBilling",
  ADMIN_OPS: "adminOps",
  SUPER_ADMIN: "superAdmin",
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  ADMIN_OPS: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  ADMIN_BILLING: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  ADMIN_SUPPORT: "bg-purple-500/10 text-purple-600 border-purple-500/20",
}

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
  const t = useTranslations("admin.users")
  const tRoles = useTranslations("admin.roles")
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
        toast.success(t("bannedUser", { name: user!.name }))
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
        toast.success(t("unbannedUser", { name: user!.name }))
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
        const roleKey = ROLE_LABELS[newRole] ?? "user"
        toast.success(t("roleUpdated", { role: tRoles(roleKey) }))
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
        toast.success(t("sessionsRevoked"))
        setSessions([])
      }
    })
  }

  async function handleImpersonate() {
    try {
      // Log impersonation server-side first
      const formData = new FormData()
      formData.set("userId", user!.id)
      await adminImpersonateUser(formData)

      // Then perform client-side impersonation via Better Auth
      await authClient.admin.impersonateUser({ userId: user!.id })
      window.location.href = "/dashboard"
    } catch {
      toast.error(t("failedImpersonate"))
    }
  }

  const roleKey = ROLE_LABELS[user.role] ?? "user"
  const roleColor = ROLE_COLORS[user.role] ?? "bg-muted text-muted-foreground"

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
                  className={`text-[11px] ${roleColor}`}
                >
                  {tRoles(roleKey)}
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
                  {t("created")}
                </p>
                <p className="text-sm mt-0.5">
                  {format(new Date(user.createdAt), "MMM d, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {t("emailVerified")}
                </p>
                <p className="text-sm mt-0.5">
                  {user.emailVerified ? t("yes") : t("no")}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {t("organization")}
                </p>
                <p className="text-sm mt-0.5">
                  {user.organizationName ?? "\u2014"}
                </p>
              </div>
              {user.banned && user.banReason && (
                <div className="col-span-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t("banReason")}
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
                  {t("activeSessions")}
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
                  {t("loadingSessions")}
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {t("noActiveSessions")}
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
                            : t("unknownDevice")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.ipAddress ?? t("unknownIp")} &middot;{" "}
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
                {t("unban")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBanDialogOpen(true)}
                disabled={isPending}
              >
                <Ban className="size-3.5" />
                {t("ban")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRoleDialogOpen(true)}
              disabled={isPending}
            >
              <Shield className="size-3.5" />
              {user.role === "SUPER_ADMIN" ? t("demoteToUser") : t("promoteToAdmin")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeAll}
              disabled={isPending || sessions.length === 0}
            >
              <KeyRound className="size-3.5" />
              {t("revokeSessions")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImpersonate}
            >
              <UserCog className="size-3.5" />
              {t("impersonate")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("banDialogTitle", { name: user.name })}</DialogTitle>
            <DialogDescription>
              {t("banDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={t("banReasonPlaceholder")}
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBanDialogOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleBan}
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              {t("banUser")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("roleDialogTitle")}</DialogTitle>
            <DialogDescription>
              {user.role === "SUPER_ADMIN"
                ? t("roleDialogDemote", { name: user.name })
                : t("roleDialogPromote", { name: user.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleSetRole} disabled={isPending}>
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              {user.role === "SUPER_ADMIN" ? t("demoteToUser") : t("promoteToAdmin")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
