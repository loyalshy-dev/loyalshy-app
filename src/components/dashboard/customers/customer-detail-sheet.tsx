"use client"

import { useState, useEffect, useTransition, useMemo } from "react"
import { formatDistanceToNow, format } from "date-fns"
import {
  Stamp,
  Ticket,
  Crown,
  Coins,
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
  Smartphone,
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
import {
  getContactDetail,
  updateContact,
  deleteContact,
  type ContactDetail,
} from "@/server/contact-actions"
import { redeemReward } from "@/server/reward-actions"
import type { PassInstanceDetail } from "@/types/pass-instance"
import { WalletPassRenderer } from "@/components/wallet-pass-renderer"
import { buildWalletPassDesign } from "@/lib/wallet/build-wallet-pass-design"
import { parsePointsConfig, getCheapestCatalogItem, getWalletRewardText, parsePrepaidConfig } from "@/lib/pass-config"

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

const passInstanceStatusConfig: Record<
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
  SUSPENDED: {
    label: "Suspended",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  EXPIRED: {
    label: "Expired",
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

const passTypeIcons: Record<string, typeof Stamp> = {
  STAMP_CARD: Stamp,
  COUPON: Ticket,
  MEMBERSHIP: Crown,
  POINTS: Coins,
  PREPAID: CreditCard,
}

function buildWalletDesign(passInstance: PassInstanceDetail) {
  return passInstance.passDesign ? buildWalletPassDesign(passInstance.passDesign) : null
}

function getRendererProps(passInstance: PassInstanceDetail) {
  const data = passInstance.data as Record<string, unknown> | null ?? {}
  if (passInstance.passType === "POINTS") {
    const config = parsePointsConfig(passInstance.templateConfig)
    const cheapest = config ? getCheapestCatalogItem(config) : null
    const balance = (data as { pointsBalance?: number }).pointsBalance ?? 0
    return {
      currentVisits: balance,
      totalVisits: cheapest?.pointsCost ?? 100,
      rewardDescription: cheapest?.name ?? "",
    }
  }
  if (passInstance.passType === "PREPAID") {
    const config = parsePrepaidConfig(passInstance.templateConfig)
    const remaining = (data as { remainingUses?: number }).remainingUses ?? 0
    return {
      currentVisits: 0,
      totalVisits: config?.totalUses ?? 0,
      rewardDescription: "",
      remainingUses: remaining,
      totalUses: config?.totalUses ?? 0,
      prepaidValidUntil: config?.validUntil ?? undefined,
    }
  }
  const cycleData = data as { currentCycleStamps?: number }
  const stampConfig = passInstance.templateConfig as Record<string, unknown> | null ?? {}
  const currentCycleVisits = cycleData.currentCycleStamps ?? 0
  const visitsRequired = (stampConfig as { stampsRequired?: number }).stampsRequired ?? 10
  const rewardDescription = (stampConfig as { rewardDescription?: string }).rewardDescription ?? ""
  return {
    currentVisits: currentCycleVisits,
    totalVisits: visitsRequired,
    rewardDescription: getWalletRewardText(passInstance.templateConfig, rewardDescription),
  }
}

function getProgressText(passInstance: PassInstanceDetail): string {
  const data = passInstance.data as Record<string, unknown> | null ?? {}
  const stampConfig = passInstance.templateConfig as Record<string, unknown> | null ?? {}
  switch (passInstance.passType) {
    case "COUPON":
      return passInstance.status === "COMPLETED" ? "Coupon redeemed" : "Ready to redeem"
    case "MEMBERSHIP":
      return passInstance.status === "SUSPENDED" ? "Suspended" : passInstance.status === "EXPIRED" ? "Expired" : "Active member"
    case "POINTS": {
      const balance = (data as { pointsBalance?: number }).pointsBalance ?? 0
      return `${balance} pts`
    }
    case "PREPAID": {
      const remaining = (data as { remainingUses?: number }).remainingUses ?? 0
      const config = parsePrepaidConfig(passInstance.templateConfig)
      const total = config?.totalUses ?? 0
      return `${remaining} / ${total} ${config?.useLabel ?? "use"}s remaining`
    }
    default: {
      const currentCycleVisits = (data as { currentCycleStamps?: number }).currentCycleStamps ?? 0
      const visitsRequired = (stampConfig as { stampsRequired?: number }).stampsRequired ?? 10
      const rewardDescription = (stampConfig as { rewardDescription?: string }).rewardDescription ?? ""
      const remaining = visitsRequired - currentCycleVisits
      return `${remaining} visit${remaining !== 1 ? "s" : ""} until ${getWalletRewardText(passInstance.templateConfig, rewardDescription)}`
    }
  }
}


type ContactDetailSheetProps = {
  contactId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactDeleted: () => void
  onRegisterVisit?: (contactId: string, customerName: string) => void
}

export function ContactDetailSheet({
  contactId,
  open,
  onOpenChange,
  onContactDeleted,
  onRegisterVisit,
}: ContactDetailSheetProps) {
  const [detail, setDetail] = useState<ContactDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, startDelete] = useTransition()
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null)
  const [visitTemplateFilter, setVisitProgramFilter] = useState<string | null>(null)
  const [rewardTemplateFilter, setRewardProgramFilter] = useState<string | null>(null)

  // Fetch detail when contactId changes
  useEffect(() => {
    if (!contactId || !open) {
      setDetail(null)
      setIsEditing(false)
      return
    }

    setIsLoading(true)
    getContactDetail(contactId)
      .then((data) => {
        setDetail(data)
        setIsLoading(false)
      })
      .catch(() => {
        toast.error("Failed to load customer details")
        setIsLoading(false)
      })
  }, [contactId, open])

  function handleDelete() {
    if (!contactId) return
    startDelete(async () => {
      const result = await deleteContact(contactId)
      if (result.success) {
        toast.success("Contact deleted")
        setShowDeleteDialog(false)
        onOpenChange(false)
        onContactDeleted()
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
      if (contactId) {
        const updated = await getContactDetail(contactId)
        if (updated) setDetail(updated)
      }
    })()
  }

  // Compute aggregate stats from pass instances
  const totalRewardsRedeemed = detail?.rewards.filter((r) => r.status === "REDEEMED").length ?? 0
  const activeRewards = detail?.rewards.filter((r) => r.status === "AVAILABLE").length ?? 0

  // Unique template names for interaction filter
  const visitTemplates = useMemo(() => {
    if (!detail) return []
    const names = new Set(detail.interactions.map((v) => v.templateName))
    return Array.from(names)
  }, [detail])

  const filteredVisits = useMemo(() => {
    if (!detail) return []
    if (!visitTemplateFilter) return detail.interactions
    return detail.interactions.filter((v) => v.templateName === visitTemplateFilter)
  }, [detail, visitTemplateFilter])

  // Unique template names for reward filter
  const rewardTemplates = useMemo(() => {
    if (!detail) return []
    const names = new Set(detail.rewards.map((r) => r.templateName))
    return Array.from(names)
  }, [detail])

  const filteredRewards = useMemo(() => {
    if (!detail) return []
    if (!rewardTemplateFilter) return detail.rewards
    return detail.rewards.filter((r) => r.templateName === rewardTemplateFilter)
  }, [detail, rewardTemplateFilter])

  // Primary pass instance type for context-aware button
  const primaryPassInstance = detail?.passInstances.find((e) => e.status === "ACTIVE") ?? detail?.passInstances[0]
  const primaryPassType = primaryPassInstance?.passType

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg p-0 overflow-hidden flex flex-col">
          {isLoading ? (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>Contact details</SheetTitle>
              </SheetHeader>
              <DetailSkeleton />
            </>
          ) : detail ? (
            <>
              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <SheetHeader className="p-6 pb-0 pr-12">
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
                      {detail.passInstances.length} pass{detail.passInstances.length !== 1 ? "es" : ""}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] px-1.5 py-0 gap-1">
                      <CalendarDays className="size-3" />
                      Joined {format(new Date(detail.createdAt), "MMM d, yyyy")}
                    </Badge>
                    {detail.lastInteractionAt && (
                      <Badge variant="outline" className="text-[11px] px-1.5 py-0 gap-1">
                        <Clock className="size-3" />
                        Last visit{" "}
                        {formatDistanceToNow(new Date(detail.lastInteractionAt), {
                          addSuffix: true,
                        })}
                      </Badge>
                    )}
                  </div>
                </SheetHeader>

                {/* Pass Instance Progress Rings */}
                <PassInstanceProgressSection passInstances={detail.passInstances} />

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 px-6 pb-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <p className="text-lg font-semibold tabular-nums">{detail.totalInteractions}</p>
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
                <Tabs defaultValue="visits">
                  <TabsList className="mx-6 mt-4 mb-0 h-8 bg-muted/50">
                    <TabsTrigger value="visits" className="text-[12px] h-6 px-3">
                      Visits ({detail.interactions.length})
                    </TabsTrigger>
                    <TabsTrigger value="rewards" className="text-[12px] h-6 px-3">
                      Rewards ({detail.rewards.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="visits" className="mt-0">
                    <div className="px-6 pt-3 pb-4">
                      {/* Program filter pills */}
                      {visitTemplates.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <button
                            onClick={() => setVisitProgramFilter(null)}
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                              !visitTemplateFilter
                                ? "bg-brand/10 text-brand border-brand/20"
                                : "bg-transparent text-muted-foreground border-border hover:border-brand/30"
                            }`}
                          >
                            All
                          </button>
                          {visitTemplates.map((name) => (
                            <button
                              key={name}
                              onClick={() => setVisitProgramFilter(visitTemplateFilter === name ? null : name)}
                              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                                visitTemplateFilter === name
                                  ? "bg-brand/10 text-brand border-brand/20"
                                  : "bg-transparent text-muted-foreground border-border hover:border-brand/30"
                              }`}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}

                      {detail.interactions.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground text-center py-8">
                          No visits recorded yet.
                        </p>
                      ) : filteredVisits.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground text-center py-8">
                          No visits for this program.
                        </p>
                      ) : (
                        <div className="space-y-0">
                          {filteredVisits.map((visit) => {
                            const VisitIcon = passTypeIcons[visit.passType] ?? Stamp
                            return (
                            <div
                              key={visit.id}
                              className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                            >
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10">
                                <VisitIcon className="size-3.5 text-brand" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium">
                                  {visit.passType === "MEMBERSHIP" ? "Check-in" : visit.passType === "PREPAID" ? "Use pass" : "Visit"}
                                  {!visitTemplateFilter && visitTemplates.length > 1 && (
                                    <span className="text-[11px] text-muted-foreground font-normal ml-1.5">
                                      {visit.templateName}
                                    </span>
                                  )}
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
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="rewards" className="mt-0">
                    <div className="px-6 pt-3 pb-4">
                      {/* Program filter pills */}
                      {rewardTemplates.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <button
                            onClick={() => setRewardProgramFilter(null)}
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                              !rewardTemplateFilter
                                ? "bg-brand/10 text-brand border-brand/20"
                                : "bg-transparent text-muted-foreground border-border hover:border-brand/30"
                            }`}
                          >
                            All
                          </button>
                          {rewardTemplates.map((name) => (
                            <button
                              key={name}
                              onClick={() => setRewardProgramFilter(rewardTemplateFilter === name ? null : name)}
                              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                                rewardTemplateFilter === name
                                  ? "bg-brand/10 text-brand border-brand/20"
                                  : "bg-transparent text-muted-foreground border-border hover:border-brand/30"
                              }`}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}

                      {detail.rewards.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground text-center py-8">
                          No rewards earned yet.
                        </p>
                      ) : filteredRewards.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground text-center py-8">
                          No rewards for this program.
                        </p>
                      ) : (
                        <div className="space-y-0">
                          {filteredRewards.map((reward) => {
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
                                    {!rewardTemplateFilter && rewardTemplates.length > 1 && (
                                      <span className="text-[11px] text-muted-foreground font-normal ml-1.5">
                                        {reward.templateName}
                                      </span>
                                    )}
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
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Actions — pinned at bottom */}
              <div className="shrink-0 p-4 border-t border-border flex flex-wrap items-center gap-2">
                {onRegisterVisit && (() => {
                  const ActionIcon = primaryPassType === "PREPAID" ? CreditCard
                    : primaryPassType === "MEMBERSHIP" ? Crown
                    : primaryPassType === "COUPON" ? Ticket
                    : primaryPassType === "POINTS" ? Coins
                    : Stamp
                  const actionLabel = primaryPassType === "PREPAID" ? "Use Pass"
                    : primaryPassType === "MEMBERSHIP" ? "Check In"
                    : primaryPassType === "COUPON" ? "Redeem Coupon"
                    : "Register Visit"
                  return (
                    <Button
                      size="sm"
                      className="gap-1.5 text-[13px] h-9 flex-1 min-w-[120px]"
                      onClick={() => {
                        onOpenChange(false)
                        onRegisterVisit(detail.id, detail.fullName)
                      }}
                    >
                      <ActionIcon className="size-3.5" />
                      {actionLabel}
                    </Button>
                  )
                })()}
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
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>Contact details</SheetTitle>
              </SheetHeader>
              <div className="flex items-center justify-center flex-1 text-[13px] text-muted-foreground">
                Contact not found
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      {detail && (
        <EditContactDialog
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
            <DialogTitle className="text-base">Delete Contact</DialogTitle>
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

// ─── Pass Instance Cards Section ──────────────────────────

const typeLabels: Record<string, string> = {
  STAMP_CARD: "Stamp Card",
  COUPON: "Coupon",
  MEMBERSHIP: "Membership",
  POINTS: "Points",
  PREPAID: "Prepaid Pass",
}

function PassInstanceCard({ passInstance }: { passInstance: PassInstanceDetail }) {
  const TypeIcon = passTypeIcons[passInstance.passType] ?? Stamp
  const statusCfg = passInstanceStatusConfig[passInstance.status] ?? passInstanceStatusConfig.CANCELLED
  const isInactive = passInstance.status !== "ACTIVE"
  const design = buildWalletDesign(passInstance)
  const walletLabel = passInstance.walletProvider === "APPLE" ? "Apple Wallet"
    : passInstance.walletProvider === "GOOGLE" ? "Google Wallet"
    : null

  // Extract type-specific data from the data JSON
  const data = passInstance.data as Record<string, unknown> | null ?? {}
  const stampConfig = passInstance.templateConfig as Record<string, unknown> | null ?? {}
  const currentCycleVisits = (data as { currentCycleStamps?: number }).currentCycleStamps ?? 0
  const visitsRequired = (stampConfig as { stampsRequired?: number }).stampsRequired ?? 10
  const pointsBalance = (data as { pointsBalance?: number }).pointsBalance ?? 0
  const remainingUses = (data as { remainingUses?: number }).remainingUses ?? 0
  const membershipData = data as { totalCheckIns?: number }

  return (
    <div className={`rounded-lg border border-border p-3 ${isInactive ? "opacity-60" : ""}`}>
      <div className="flex gap-3">
        {/* Mini card preview */}
        {design && (
          <div className="shrink-0">
            <WalletPassRenderer
              design={design}
              format="apple"
              programName={passInstance.templateName}
              {...getRendererProps(passInstance)}
              compact
              width={72}
              height={96}
            />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Header: icon + name + status */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <TypeIcon className="size-3 text-brand shrink-0" />
            <p className="text-[12px] font-medium truncate flex-1">{passInstance.templateName}</p>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 shrink-0 ${statusCfg.className}`}
            >
              {statusCfg.label}
            </Badge>
          </div>

          {/* Type-specific content */}
          {passInstance.passType === "STAMP_CARD" && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${Math.min((currentCycleVisits / visitsRequired) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums font-medium">
                  {currentCycleVisits}/{visitsRequired}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {getProgressText(passInstance)}
              </p>
            </div>
          )}

          {passInstance.passType === "COUPON" && (
            <p className="text-[11px] text-muted-foreground">
              {passInstance.status === "COMPLETED" ? "Coupon redeemed" : "Ready to redeem"}
            </p>
          )}

          {passInstance.passType === "MEMBERSHIP" && (
            <div className="space-y-0.5">
              {passInstance.expiresAt && (
                <p className="text-[11px] text-muted-foreground">
                  {passInstance.status === "EXPIRED" ? "Expired" : "Expires"} {format(new Date(passInstance.expiresAt), "MMM d, yyyy")}
                </p>
              )}
              {passInstance.status === "SUSPENDED" && passInstance.suspendedAt && (
                <p className="text-[11px] text-warning">
                  Suspended {format(new Date(passInstance.suspendedAt), "MMM d, yyyy")}
                </p>
              )}
              {passInstance.status === "ACTIVE" && (
                <p className="text-[11px] text-muted-foreground">
                  {membershipData.totalCheckIns ?? 0} check-in{(membershipData.totalCheckIns ?? 0) !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          {passInstance.passType === "POINTS" && (() => {
            const config = parsePointsConfig(passInstance.templateConfig)
            const cheapest = config ? getCheapestCatalogItem(config) : null
            return (
              <div className="space-y-0.5">
                <p className="text-base font-semibold tabular-nums leading-tight">{pointsBalance} <span className="text-[11px] font-normal text-muted-foreground">pts</span></p>
                {cheapest && (
                  <p className="text-[11px] text-muted-foreground">
                    Next: {cheapest.name} ({cheapest.pointsCost} pts)
                  </p>
                )}
              </div>
            )
          })()}

          {passInstance.passType === "PREPAID" && (() => {
            const config = parsePrepaidConfig(passInstance.templateConfig)
            const total = config?.totalUses ?? 0
            const pct = total > 0 ? Math.min((remainingUses / total) * 100, 100) : 0
            const useLabel = config?.useLabel ?? "use"
            return (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums font-medium">
                    {remainingUses}/{total}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {remainingUses} {useLabel}{remainingUses !== 1 ? "s" : ""} remaining
                  {config?.validUntil && ` · Expires ${format(new Date(config.validUntil), "MMM d, yyyy")}`}
                </p>
              </div>
            )
          })()}

          {/* Footer: wallet indicator + issued date */}
          <div className="flex items-center gap-2 mt-1.5">
            {walletLabel && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Smartphone className="size-2.5" />
                {walletLabel}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {walletLabel && "·"} Enrolled {format(new Date(passInstance.issuedAt), "MMM d, yyyy")}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PassInstanceProgressSection({
  passInstances,
}: {
  passInstances: PassInstanceDetail[]
}) {
  if (passInstances.length === 0) {
    return (
      <div className="flex flex-col items-center py-6">
        <p className="text-[12px] text-muted-foreground">No pass instances</p>
      </div>
    )
  }

  // Sort: active first, then by issued date
  const sorted = [...passInstances].sort((a, b) => {
    if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1
    if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1
    return new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
  })

  return (
    <div className="px-6 py-4 space-y-2">
      {sorted.map((passInstance) => (
        <PassInstanceCard key={passInstance.passInstanceId} passInstance={passInstance} />
      ))}
    </div>
  )
}

// ─── Edit Dialog ────────────────────────────────────────────

type EditContactDialogProps = {
  detail: ContactDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (data: { fullName: string; email: string | null; phone: string | null }) => void
}

function EditContactDialog({
  detail,
  open,
  onOpenChange,
  onUpdated,
}: EditContactDialogProps) {
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
      formData.set("contactId", detail.id)

      formData.set("fullName", data.fullName)
      formData.set("email", data.email)
      formData.set("phone", data.phone)

      const result = await updateContact(formData)

      if (!result.success) {
        if (result.duplicateField) {
          setError(result.duplicateField, { message: result.error })
        } else {
          toast.error(result.error ?? "Failed to update customer")
        }
        return
      }

      toast.success("Contact updated")
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
          <DialogTitle className="text-base">Edit Contact</DialogTitle>
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
