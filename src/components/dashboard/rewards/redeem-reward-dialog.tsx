"use client"

import { useTransition } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { Gift, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { redeemReward, type RewardRow } from "@/server/reward-actions"

type RedeemRewardDialogProps = {
  reward: RewardRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRedeemed: () => void
}

export function RedeemRewardDialog({
  reward,
  open,
  onOpenChange,
  onRedeemed,
}: RedeemRewardDialogProps) {
  const [isRedeeming, startRedeem] = useTransition()

  function handleRedeem() {
    if (!reward) return

    startRedeem(async () => {
      const result = await redeemReward(reward.id)

      if (!result.success) {
        toast.error(result.error ?? "Failed to redeem reward")
        return
      }

      toast.success(`Reward redeemed for ${reward.contactName}`, {
        description: reward.description,
      })
      onOpenChange(false)
      onRedeemed()
    })
  }

  if (!reward) return null

  const isExpired = new Date(reward.expiresAt) < new Date()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Redeem Reward</DialogTitle>
          <DialogDescription className="text-[13px]">
            Confirm this reward redemption for the contact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Reward info card */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                <Gift className="size-5 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold truncate">
                  {reward.contactName}
                </p>
                <p className="text-[13px] text-brand font-medium">
                  {reward.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <p className="text-muted-foreground">Earned</p>
                <p className="font-medium">
                  {format(new Date(reward.earnedAt), "MMM d, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Expires</p>
                <p className={`font-medium ${isExpired ? "text-destructive" : ""}`}>
                  {isExpired
                    ? "Expired"
                    : formatDistanceToNow(new Date(reward.expiresAt), {
                        addSuffix: true,
                      })}
                </p>
              </div>
            </div>
          </div>

          {isExpired && (
            <p className="text-[12px] text-destructive flex items-center gap-1.5">
              This reward has expired and cannot be redeemed.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-[13px]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleRedeem}
            disabled={isRedeeming || isExpired}
            className="gap-1.5 text-[13px]"
          >
            {isRedeeming ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            Redeem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
