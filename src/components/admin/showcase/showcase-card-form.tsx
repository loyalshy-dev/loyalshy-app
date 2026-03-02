"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createShowcaseCard,
  updateShowcaseCardMetadata,
  type ShowcaseMetadata,
} from "@/server/showcase-actions"

type ShowcaseCard = {
  id: string
  metadata: unknown
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editCard: ShowcaseCard | null
  onSuccess: () => void
}

function getDefaults(card: ShowcaseCard | null): ShowcaseMetadata {
  if (!card) {
    return {
      restaurantName: "",
      currentVisits: 5,
      totalVisits: 10,
      rewardDescription: "",
      customerName: "",
      memberSince: "Jan 2026",
    }
  }
  const m = (card.metadata ?? {}) as Record<string, unknown>
  return {
    restaurantName: (m.restaurantName as string) ?? "",
    currentVisits: (m.currentVisits as number) ?? 5,
    totalVisits: (m.totalVisits as number) ?? 10,
    rewardDescription: (m.rewardDescription as string) ?? "",
    customerName: (m.customerName as string) ?? "",
    memberSince: (m.memberSince as string) ?? "Jan 2026",
  }
}

export function ShowcaseCardForm({ open, onOpenChange, editCard, onSuccess }: Props) {
  const defaults = getDefaults(editCard)
  const [restaurantName, setRestaurantName] = useState(defaults.restaurantName)
  const [currentVisits, setCurrentVisits] = useState(defaults.currentVisits)
  const [totalVisits, setTotalVisits] = useState(defaults.totalVisits)
  const [rewardDescription, setRewardDescription] = useState(defaults.rewardDescription)
  const [customerName, setCustomerName] = useState(defaults.customerName)
  const [memberSince, setMemberSince] = useState(defaults.memberSince)
  const [isPending, startTransition] = useTransition()

  // Reset form when editCard changes
  const [prevEditId, setPrevEditId] = useState<string | null>(null)
  if ((editCard?.id ?? null) !== prevEditId) {
    setPrevEditId(editCard?.id ?? null)
    const d = getDefaults(editCard)
    setRestaurantName(d.restaurantName)
    setCurrentVisits(d.currentVisits)
    setTotalVisits(d.totalVisits)
    setRewardDescription(d.rewardDescription)
    setCustomerName(d.customerName)
    setMemberSince(d.memberSince)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const metadata: ShowcaseMetadata = {
      restaurantName,
      currentVisits,
      totalVisits,
      rewardDescription,
      customerName,
      memberSince,
    }

    startTransition(async () => {
      try {
        if (editCard) {
          const result = await updateShowcaseCardMetadata(editCard.id, metadata)
          if ("error" in result) {
            toast.error(String(result.error))
            return
          }
          toast.success("Card info updated")
        } else {
          const result = await createShowcaseCard(metadata)
          if ("error" in result) {
            toast.error(String(result.error))
            return
          }
          toast.success("Card created")
        }
        onSuccess()
      } catch {
        toast.error("Something went wrong")
      }
    })
  }

  const isValid = restaurantName.trim() && rewardDescription.trim() && customerName.trim() && memberSince.trim() && totalVisits > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editCard ? "Edit Card Info" : "New Showcase Card"}</DialogTitle>
          <DialogDescription>
            {editCard
              ? "Update the marketing metadata for this card."
              : "Set the restaurant name and visit data for the card preview."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sc-restaurant">Restaurant Name</Label>
            <Input
              id="sc-restaurant"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="Aurum Kitchen"
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sc-current-visits">Current Visits</Label>
              <Input
                id="sc-current-visits"
                type="number"
                min={0}
                max={100}
                value={currentVisits}
                onChange={(e) => setCurrentVisits(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sc-total-visits">Total Visits</Label>
              <Input
                id="sc-total-visits"
                type="number"
                min={1}
                max={100}
                value={totalVisits}
                onChange={(e) => setTotalVisits(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sc-reward">Reward Description</Label>
            <Input
              id="sc-reward"
              value={rewardDescription}
              onChange={(e) => setRewardDescription(e.target.value)}
              placeholder="Free tasting menu"
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sc-customer">Customer Name</Label>
              <Input
                id="sc-customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Sophie L."
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sc-member">Member Since</Label>
              <Input
                id="sc-member"
                value={memberSince}
                onChange={(e) => setMemberSince(e.target.value)}
                placeholder="Jan 2026"
                maxLength={50}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !isValid}>
              {isPending ? "Saving..." : editCard ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
