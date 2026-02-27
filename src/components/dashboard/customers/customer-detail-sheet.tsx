"use client"

import { useState, useEffect, useTransition } from "react"
import { formatDistanceToNow, format } from "date-fns"
import {
  Stamp,
  Gift,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Mail,
  Phone,
  Clock,
  CalendarDays,
  CheckCircle2,
  CreditCard,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProgressRing } from "./customer-progress-ring"
import {
  getCustomerDetail,
  updateCustomer,
  deleteCustomer,
  type CustomerDetail,
} from "@/server/customer-actions"
import { redeemReward } from "@/server/reward-actions"
import type { EnrollmentDetail } from "@/types/enrollment"

// Deterministic avatar color from name
function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `oklch(0.55 0.12 ${hue})`
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const walletLabels: Record<string, string> = {
  APPLE: "Apple Wallet",
  GOOGLE: "Google Wallet",
  NONE: "No Wallet Pass",
}

const enrollmentStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Active",
    className: "bg-success/10 text-success border-success/20",
  },
  FROZEN: {
    label: "Frozen",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-brand/10 text-brand border-brand/20",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground border-border",
  },
}

const rewardStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  AVAILABLE: {
    label: "Available",
    className: "bg-success/10 text-success border-success/20",
  },
  REDEEMED: {
    label: "Redeemed",
    className: "bg-brand/10 text-brand border-brand/20",
  },
  EXPIRED: {
    label: "Expired",
    className: "bg-muted text-muted-foreground border-border",
  },
}

type CustomerDetailSheetProps = {
  customerId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCustomerDeleted: () => void
  onRegisterVisit?: (customerId: string, customerName: string) => void
}

export function CustomerDetailSheet({
  customerId,
  open,
  onOpenChange,
  onCustomerDeleted,
  onRegisterVisit,
}: CustomerDetailSheetProps) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, startDelete] = useTransition()
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null)

  // Fetch detail when customerId changes
  useEffect(() => {
    if (!customerId || !open) {
      setDetail(null)
      setIsEditing(false)
      return
    }

    setIsLoading(true)
    getCustomerDetail(customerId)
      .then((data) => {
        setDetail(data)
        setIsLoading(false)
      })
      .catch(() => {
        toast.error("Failed to load customer details")
        setIsLoading(false)
      })
  }, [customerId, open])

  function handleDelete() {
    if (!customerId) return
    startDelete(async () => {
      const result = await deleteCustomer(customerId)
      if (result.success) {
        toast.success("Customer deleted")
        setShowDeleteDialog(false)
        onOpenChange(false)
        onCustomerDeleted()
      } else {
        toast.error(result.error ?? "Failed to delete customer")
      }
    })
  }

  function handleRedeemReward(rewardId: string) {
    setRedeemingRewardId(rewardId)
    ;(async () => {
      const result = await redeemReward(rewardId)
      setRedeemingRewardId(null)
      if (!result.success) {
        toast.error(result.error ?? "Failed to redeem reward")
        return
      }
      toast.success("Reward redeemed!")
      // Refresh detail
      if (customerId) {
        const updated = await getCustomerDetail(customerId)
        if (updated) setDetail(updated)
      }
    })()
  }

  // Compute aggregate stats from enrollments
  const totalRewardsRedeemed = detail?.enrollments.reduce(
    (sum, e) => sum + e.totalRewardsRedeemed,
    0
  ) ?? 0
  const activeRewards = detail?.rewards.filter((r) => r.status === "AVAILABLE").length ?? 0

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg p-0 overflow-hidden flex flex-col">
          {isLoading ? (
            <DetailSkeleton />
          ) : detail ? (
            <>
              <SheetHeader className="p-6 pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
                      style={{ backgroundColor: getAvatarColor(detail.fullName) }}
                    >
                      {getInitials(detail.fullName)}
                    </div>
                    <div>
                      <SheetTitle className="text-lg">{detail.fullName}</SheetTitle>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        {detail.email && (
                          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                            <Mail className="size-3 shrink-0" />
                            <span className="truncate">{detail.email}</span>
                          </span>
                        )}
                        {detail.phone && (
                          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                            <Phone className="size-3 shrink-0" />
                            {detail.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meta badges */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge variant="outline" className="text-[11px] px-1.5 py-0 gap-1">
                    <CreditCard className="size-3" />
                    {detail.enrollments.length} program{detail.enrollments.length !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] px-1.5 py-0 gap-1">
                    <CalendarDays className="size-3" />
                    Joined {format(new Date(detail.createdAt), "MMM d, yyyy")}
                  </Badge>
                  {detail.lastVisitAt && (
                    <Badge variant="outline" className="text-[11px] px-1.5 py-0 gap-1">
                      <Clock className="size-3" />
                      Last visit{" "}
                      {formatDistanceToNow(new Date(detail.lastVisitAt), {
                        addSuffix: true,
                      })}
                    </Badge>
                  )}
                </div>
              </SheetHeader>

              {/* Enrollment Progress Rings */}
              <EnrollmentProgressSection enrollments={detail.enrollments} />

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4 px-6 pb-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-semibold tabular-nums">{detail.totalVisits}</p>
                  <p className="text-[11px] text-muted-foreground">Total Visits</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-semibold tabular-nums">{totalRewardsRedeemed}</p>
                  <p className="text-[11px] text-muted-foreground">Rewards Used</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-semibold tabular-nums">{activeRewards}</p>
                  <p className="text-[11px] text-muted-foreground">Active Rewards</p>
                </div>
              </div>

              <Separator />

              {/* Tabs: Visits / Rewards */}
              <Tabs defaultValue="visits" className="flex-1 flex flex-col min-h-0">
                <TabsList className="mx-6 mt-4 mb-0 h-8 bg-muted/50">
                  <TabsTrigger value="visits" className="text-[12px] h-6 px-3">
                    Visits ({detail.visits.length})
                  </TabsTrigger>
                  <TabsTrigger value="rewards" className="text-[12px] h-6 px-3">
                    Rewards ({detail.rewards.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="visits" className="flex-1 min-h-0 mt-0">
                  <ScrollArea className="h-[40vh] min-h-[180px] px-6 pt-3">
                    {detail.visits.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground text-center py-8">
                        No visits recorded yet.
                      </p>
                    ) : (
                      <div className="space-y-0">
                        {detail.visits.map((visit) => (
                          <div
                            key={visit.id}
                            className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                          >
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10">
                              <Stamp className="size-3.5 text-brand" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium">
                                Visit #{visit.visitNumber}
                                <span className="text-[11px] text-muted-foreground font-normal ml-1.5">
                                  {visit.programName}
                                </span>
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {visit.registeredBy
                                  ? `by ${visit.registeredBy}`
                                  : "Self-registered"}
                              </p>
                            </div>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {formatDistanceToNow(new Date(visit.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="rewards" className="flex-1 min-h-0 mt-0">
                  <ScrollArea className="h-[40vh] min-h-[180px] px-6 pt-3">
                    {detail.rewards.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground text-center py-8">
                        No rewards earned yet.
                      </p>
                    ) : (
                      <div className="space-y-0">
                        {detail.rewards.map((reward) => {
                          const config =
                            rewardStatusConfig[reward.status] ??
                            rewardStatusConfig.EXPIRED
                          return (
                            <div
                              key={reward.id}
                              className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                            >
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success/10">
                                <Gift className="size-3.5 text-success" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium">
                                  {reward.description}
                                  <span className="text-[11px] text-muted-foreground font-normal ml-1.5">
                                    {reward.programName}
                                  </span>
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Earned {format(new Date(reward.earnedAt), "MMM d, yyyy")}
                                  {reward.redeemedAt &&
                                    ` — Redeemed ${format(new Date(reward.redeemedAt), "MMM d")}`}
                                </p>
                              </div>
                              {reward.status === "AVAILABLE" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[11px] gap-1 px-2 shrink-0"
                                  disabled={redeemingRewardId === reward.id}
                                  onClick={() => handleRedeemReward(reward.id)}
                                >
                                  {redeemingRewardId === reward.id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="size-3" />
                                  )}
                                  Redeem
                                </Button>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] px-1.5 py-0 ${config.className}`}
                                >
                                  {config.label}
                                </Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>

              {/* Actions */}
              <div className="p-4 border-t border-border flex flex-wrap items-center gap-2">
                {onRegisterVisit && (
                  <Button
                    size="sm"
                    className="gap-1.5 text-[13px] h-9 flex-1 min-w-[120px]"
                    onClick={() => {
                      onOpenChange(false)
                      onRegisterVisit(detail.id, detail.fullName)
                    }}
                  >
                    <Stamp className="size-3.5" />
                    Register Visit
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-[13px] h-9 flex-1 min-w-[80px]"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-[13px] h-9 text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="size-3.5" />
                  <span className="hidden xs:inline">Delete</span>
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center flex-1 text-[13px] text-muted-foreground">
              Customer not found
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      {detail && (
        <EditCustomerDialog
          detail={detail}
          open={isEditing}
          onOpenChange={setIsEditing}
          onUpdated={(updated) => {
            setDetail({ ...detail, ...updated })
            setIsEditing(false)
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Customer</DialogTitle>
            <DialogDescription className="text-[13px]">
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{detail?.fullName}</span>?
              This will permanently remove all their visit and reward history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              className="text-[13px]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="gap-1.5 text-[13px]"
            >
              {isDeleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Enrollment Progress Section ─────────────────────────────

function EnrollmentProgressSection({
  enrollments,
}: {
  enrollments: EnrollmentDetail[]
}) {
  const activeEnrollments = enrollments.filter((e) => e.status === "ACTIVE")
  const otherEnrollments = enrollments.filter((e) => e.status !== "ACTIVE")

  if (enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center py-6">
        <p className="text-[12px] text-muted-foreground">No program enrollments</p>
      </div>
    )
  }

  // Single enrollment — show full-size progress ring
  if (activeEnrollments.length === 1 && otherEnrollments.length === 0) {
    const enrollment = activeEnrollments[0]
    return (
      <div className="flex items-center justify-center py-6">
        <div className="text-center">
          <ProgressRing
            current={enrollment.currentCycleVisits}
            total={enrollment.visitsRequired}
          />
          <p className="text-[12px] font-medium mt-2">{enrollment.programName}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {enrollment.visitsRequired - enrollment.currentCycleVisits} visits until {enrollment.rewardDescription}
          </p>
        </div>
      </div>
    )
  }

  // Multiple enrollments — show compact progress rings side by side
  return (
    <div className="py-4 px-6">
      <div className="flex flex-wrap items-start justify-center gap-6">
        {activeEnrollments.map((enrollment) => (
          <div key={enrollment.enrollmentId} className="text-center">
            <ProgressRing
              current={enrollment.currentCycleVisits}
              total={enrollment.visitsRequired}
              size={80}
              strokeWidth={6}
            />
            <p className="text-[11px] font-medium mt-1.5 max-w-[100px] truncate">
              {enrollment.programName}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {enrollment.visitsRequired - enrollment.currentCycleVisits} to go
            </p>
          </div>
        ))}
      </div>

      {/* Inactive enrollments summary */}
      {otherEnrollments.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {otherEnrollments.map((enrollment) => {
            const config = enrollmentStatusConfig[enrollment.status] ?? enrollmentStatusConfig.CANCELLED
            return (
              <Badge
                key={enrollment.enrollmentId}
                variant="outline"
                className={`text-[10px] px-1.5 py-0 gap-1 ${config.className}`}
              >
                {enrollment.programName} — {config.label}
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Edit Dialog ────────────────────────────────────────────

type EditCustomerDialogProps = {
  detail: CustomerDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (data: { fullName: string; email: string | null; phone: string | null }) => void
}

function EditCustomerDialog({
  detail,
  open,
  onOpenChange,
  onUpdated,
}: EditCustomerDialogProps) {
  const [isUpdating, startUpdate] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm({
    defaultValues: {
      fullName: detail.fullName,
      email: detail.email ?? "",
      phone: detail.phone ?? "",
    },
  })

  function onSubmit(data: { fullName: string; email: string; phone: string }) {
    startUpdate(async () => {
      const formData = new FormData()
      formData.set("customerId", detail.id)
      formData.set("fullName", data.fullName)
      formData.set("email", data.email)
      formData.set("phone", data.phone)

      const result = await updateCustomer(formData)

      if (!result.success) {
        if (result.duplicateField) {
          setError(result.duplicateField, { message: result.error })
        } else {
          toast.error(result.error ?? "Failed to update customer")
        }
        return
      }

      toast.success("Customer updated")
      onUpdated({
        fullName: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
      })
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-fullName" className="text-[13px]">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-fullName"
              className="h-9 text-[13px]"
              {...register("fullName", { required: "Name is required" })}
            />
            {errors.fullName && (
              <p className="flex items-center gap-1 text-[11px] text-destructive">
                <AlertCircle className="size-3" />
                {errors.fullName.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email" className="text-[13px]">
              Email
            </Label>
            <Input
              id="edit-email"
              type="email"
              className="h-9 text-[13px]"
              {...register("email")}
            />
            {errors.email && (
              <p className="flex items-center gap-1 text-[11px] text-destructive">
                <AlertCircle className="size-3" />
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone" className="text-[13px]">
              Phone
            </Label>
            <Input
              id="edit-phone"
              type="tel"
              className="h-9 text-[13px]"
              {...register("phone")}
            />
            {errors.phone && (
              <p className="flex items-center gap-1 text-[11px] text-destructive">
                <AlertCircle className="size-3" />
                {errors.phone.message}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-[13px]"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isUpdating} className="gap-1.5 text-[13px]">
              {isUpdating && <Loader2 className="size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Detail Skeleton ────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-full bg-muted" />
        <div className="space-y-1.5">
          <div className="h-5 w-36 rounded bg-muted" />
          <div className="h-3 w-48 rounded bg-muted/60" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-5 w-24 rounded-full bg-muted" />
        <div className="h-5 w-28 rounded-full bg-muted" />
      </div>
      <div className="flex justify-center">
        <div className="size-[120px] rounded-full bg-muted" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-7 rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-3.5 w-24 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
