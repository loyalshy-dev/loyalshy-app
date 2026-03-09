"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import {
  UserPlus,
  MoreHorizontal,
  Mail,
  Clock,
  Shield,
  ShieldCheck,
  Trash2,
  RefreshCw,
  X,
  Check,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  inviteTeamMember,
  removeTeamMember,
  changeTeamMemberRole,
  cancelInvitation,
  resendInvitation,
} from "@/server/org-settings-actions"
import { Card } from "@/components/ui/card"

type InviteForm = {
  email: string
  role: "owner" | "staff"
}

type Organization = {
  id: string
  name: string
}

type Member = {
  id: string
  userId: string
  role: string
  createdAt: Date
  user: {
    id: string
    name: string
    email: string
    image: string | null
    createdAt: Date
  }
}

type PendingInvitation = {
  id: string
  email: string
  role: string
  createdAt: Date
  expiresAt: Date
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function TeamManagement({
  organization,
  members,
  pendingInvitations,
  currentUserId,
}: {
  organization: Organization
  members: Member[]
  pendingInvitations: PendingInvitation[]
  currentUserId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeMember, setRemoveMember] = useState<Member | null>(null)
  const [cancelInvite, setCancelInvite] = useState<PendingInvitation | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<InviteForm>({
    defaultValues: { email: "", role: "staff" },
  })

  const selectedRole = watch("role")

  function onInviteSubmit(data: InviteForm) {
    startTransition(async () => {
      const result = await inviteTeamMember({
        organizationId: organization.id,
        ...data,
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success(`Invitation sent to ${data.email}`)
        setInviteOpen(false)
        reset()
      }
    })
  }

  function handleRemoveMember() {
    if (!removeMember) return
    startTransition(async () => {
      const result = await removeTeamMember(organization.id, removeMember.id)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success(`${removeMember.user.name} has been removed`)
      }
      setRemoveMember(null)
    })
  }

  function handleCancelInvitation() {
    if (!cancelInvite) return
    startTransition(async () => {
      const result = await cancelInvitation(organization.id, cancelInvite.id)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Invitation cancelled")
      }
      setCancelInvite(null)
    })
  }

  function handleResendInvitation(invitation: PendingInvitation) {
    startTransition(async () => {
      const result = await resendInvitation(organization.id, invitation.id)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success(`Invitation resent to ${invitation.email}`)
      }
    })
  }

  function handleChangeRole(member: Member, newRole: "owner" | "member") {
    startTransition(async () => {
      const result = await changeTeamMemberRole(organization.id, member.id, newRole)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        const label = newRole === "owner" ? "Owner" : "Staff"
        toast.success(`${member.user.name} is now ${label}`)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Team Members */}
      <Card>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold">Team Members</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Invite
          </Button>
        </div>
        <div className="divide-y divide-border">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between px-6 py-3.5"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.user.image ?? undefined} />
                  <AvatarFallback className="text-[10px] font-medium bg-muted">
                    {getInitials(member.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium leading-none">
                    {member.user.name}
                    {member.user.id === currentUserId && (
                      <span className="ml-1.5 text-xs text-muted-foreground font-normal">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {member.user.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={member.role === "owner" ? "default" : "secondary"}
                  className="text-[10px] font-medium"
                >
                  {member.role === "owner" ? (
                    <ShieldCheck className="mr-1 h-3 w-3" />
                  ) : (
                    <Shield className="mr-1 h-3 w-3" />
                  )}
                  {member.role === "owner" ? "Owner" : "Staff"}
                </Badge>
                <p className="text-xs text-muted-foreground hidden sm:block w-28 text-right">
                  Joined {formatDistanceToNow(new Date(member.createdAt), { addSuffix: true })}
                </p>
                {member.user.id !== currentUserId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Member actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {member.role === "owner" ? (
                        <DropdownMenuItem
                          onClick={() => handleChangeRole(member, "member")}
                        >
                          <Shield className="mr-2 h-3.5 w-3.5" />
                          Demote to Staff
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleChangeRole(member, "owner")}
                        >
                          <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                          Promote to Owner
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setRemoveMember(member)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Remove member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">Pending Invitations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="divide-y divide-border">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-6 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-none">{inv.email}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        Expires {formatDistanceToNow(new Date(inv.expiresAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {inv.role === "OWNER" ? "Owner" : "Staff"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={isPending}
                    onClick={() => handleResendInvitation(inv)}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Resend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    disabled={isPending}
                    onClick={() => setCancelInvite(inv)}
                    aria-label={`Cancel invitation for ${inv.email}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="rounded-4xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
            <DialogDescription>
              Send an invitation to join {organization.name} as a team member.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onInviteSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                className="rounded-2xl"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "invite-email-error" : undefined}
                {...register("email", { required: "Email is required" })}
              />
              {errors.email && (
                <p id="invite-email-error" className="text-xs text-destructive" role="alert">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="grid gap-2">
                <Card
                  asChild
                  className={`
                    cursor-pointer transition-colors
                    ${selectedRole === "staff" ? "bg-accent" : "hover:bg-accent/50"}
                  `}
                >
                  <button
                    type="button"
                    onClick={() => setValue("role", "staff")}
                    className="flex items-start gap-3 px-4 py-3.5 text-left"
                  >
                    <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <span className="text-sm font-medium">Staff</span>
                      <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                        <li>Register contacts & scan passes</li>
                        <li>Record stamps, check-ins & redemptions</li>
                        <li>View contact history</li>
                      </ul>
                    </div>
                    {selectedRole === "staff" && (
                      <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                  </button>
                </Card>
                <Card
                  asChild
                  className={`
                    cursor-pointer transition-colors
                    ${selectedRole === "owner" ? "bg-accent" : "hover:bg-accent/50"}
                  `}
                >
                  <button
                    type="button"
                    onClick={() => setValue("role", "owner")}
                    className="flex items-start gap-3 px-4 py-3.5 text-left"
                  >
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <span className="text-sm font-medium">Owner</span>
                      <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                        <li>Everything Staff can do</li>
                        <li>Manage programs, design & settings</li>
                        <li>Invite & remove team members</li>
                        <li>Manage billing & subscription</li>
                      </ul>
                    </div>
                    {selectedRole === "owner" && (
                      <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                  </button>
                </Card>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="rounded-2xl"
                onClick={() => setInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-2xl" disabled={isPending}>
                {isPending ? "Sending..." : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog
        open={!!removeMember}
        onOpenChange={(open) => !open && setRemoveMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium text-foreground">
                {removeMember?.user.name}
              </span>{" "}
              from {organization.name}? They will lose access to the dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Invitation Confirmation */}
      <AlertDialog
        open={!!cancelInvite}
        onOpenChange={(open) => !open && setCancelInvite(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation to{" "}
              <span className="font-medium text-foreground">
                {cancelInvite?.email}
              </span>
              ? They will no longer be able to join using the invitation link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvitation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Cancelling..." : "Cancel invitation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
