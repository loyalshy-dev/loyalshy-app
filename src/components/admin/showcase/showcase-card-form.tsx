"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Stamp, Tag, Crown } from "lucide-react"
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

type ProgramType = "STAMP_CARD" | "COUPON" | "MEMBERSHIP"

type ShowcaseCard = {
  id: string
  metadata: unknown
  designData: unknown
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editCard: ShowcaseCard | null
  onSuccess: () => void
}

function getCardTypeFromDesign(card: ShowcaseCard | null): ProgramType {
  if (!card) return "STAMP_CARD"
  const d = (card.designData ?? {}) as Record<string, unknown>
  const ct = d.cardType as string | undefined
  if (ct === "COUPON") return "COUPON"
  if (ct === "TIER") return "MEMBERSHIP"
  return "STAMP_CARD"
}

function getDefaults(card: ShowcaseCard | null): ShowcaseMetadata {
  if (!card) {
    return {
      restaurantName: "",
      customerName: "",
      memberSince: "Jan 2026",
      currentVisits: 5,
      totalVisits: 10,
      rewardDescription: "",
      discountText: "",
      couponCode: "",
      validUntil: "",
      tierName: "",
      benefits: "",
    }
  }
  const m = (card.metadata ?? {}) as Record<string, unknown>
  return {
    restaurantName: (m.restaurantName as string) ?? "",
    customerName: (m.customerName as string) ?? "",
    memberSince: (m.memberSince as string) ?? "Jan 2026",
    currentVisits: (m.currentVisits as number) ?? 5,
    totalVisits: (m.totalVisits as number) ?? 10,
    rewardDescription: (m.rewardDescription as string) ?? "",
    discountText: (m.discountText as string) ?? "",
    couponCode: (m.couponCode as string) ?? "",
    validUntil: (m.validUntil as string) ?? "",
    tierName: (m.tierName as string) ?? "",
    benefits: (m.benefits as string) ?? "",
  }
}

const TYPE_OPTIONS: { value: ProgramType; label: string; icon: typeof Stamp }[] = [
  { value: "STAMP_CARD", label: "Stamp Card", icon: Stamp },
  { value: "COUPON", label: "Coupon", icon: Tag },
  { value: "MEMBERSHIP", label: "Membership", icon: Crown },
]

export function ShowcaseCardForm({ open, onOpenChange, editCard, onSuccess }: Props) {
  const defaults = getDefaults(editCard)
  const [programType, setProgramType] = useState<ProgramType>(getCardTypeFromDesign(editCard))
  const [restaurantName, setRestaurantName] = useState(defaults.restaurantName)
  const [customerName, setCustomerName] = useState(defaults.customerName)
  const [memberSince, setMemberSince] = useState(defaults.memberSince)
  // Stamp fields
  const [currentVisits, setCurrentVisits] = useState(defaults.currentVisits ?? 5)
  const [totalVisits, setTotalVisits] = useState(defaults.totalVisits ?? 10)
  const [rewardDescription, setRewardDescription] = useState(defaults.rewardDescription ?? "")
  // Coupon fields
  const [discountText, setDiscountText] = useState(defaults.discountText ?? "")
  const [couponCode, setCouponCode] = useState(defaults.couponCode ?? "")
  const [validUntil, setValidUntil] = useState(defaults.validUntil ?? "")
  // Membership fields
  const [tierName, setTierName] = useState(defaults.tierName ?? "")
  const [benefits, setBenefits] = useState(defaults.benefits ?? "")

  const [isPending, startTransition] = useTransition()

  // Reset form when editCard changes
  const [prevEditId, setPrevEditId] = useState<string | null>(null)
  if ((editCard?.id ?? null) !== prevEditId) {
    setPrevEditId(editCard?.id ?? null)
    const d = getDefaults(editCard)
    setProgramType(getCardTypeFromDesign(editCard))
    setRestaurantName(d.restaurantName)
    setCustomerName(d.customerName)
    setMemberSince(d.memberSince)
    setCurrentVisits(d.currentVisits ?? 5)
    setTotalVisits(d.totalVisits ?? 10)
    setRewardDescription(d.rewardDescription ?? "")
    setDiscountText(d.discountText ?? "")
    setCouponCode(d.couponCode ?? "")
    setValidUntil(d.validUntil ?? "")
    setTierName(d.tierName ?? "")
    setBenefits(d.benefits ?? "")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const metadata: ShowcaseMetadata = {
      restaurantName,
      customerName,
      memberSince,
      currentVisits,
      totalVisits,
      rewardDescription,
      discountText,
      couponCode,
      validUntil,
      tierName,
      benefits,
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
          const result = await createShowcaseCard(metadata, programType)
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

  const isValid =
    restaurantName.trim() &&
    customerName.trim() &&
    memberSince.trim() &&
    (programType === "STAMP_CARD"
      ? totalVisits > 0 && rewardDescription.trim()
      : programType === "COUPON"
        ? discountText.trim()
        : tierName.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editCard ? "Edit Card Info" : "New Showcase Card"}</DialogTitle>
          <DialogDescription>
            {editCard
              ? "Update the marketing metadata for this card."
              : "Choose a card type and set the preview data."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card type selector — only for new cards */}
          {!editCard && (
            <div className="space-y-2">
              <Label>Card Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setProgramType(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors ${
                      programType === value
                        ? "border-foreground bg-foreground/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/20"
                    }`}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {/* Stamp-specific fields */}
          {programType === "STAMP_CARD" && (
            <>
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
            </>
          )}

          {/* Coupon-specific fields */}
          {programType === "COUPON" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="sc-discount">Discount Text</Label>
                <Input
                  id="sc-discount"
                  value={discountText}
                  onChange={(e) => setDiscountText(e.target.value)}
                  placeholder="20% OFF"
                  maxLength={100}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="sc-coupon-code">Coupon Code</Label>
                  <Input
                    id="sc-coupon-code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="WELCOME20"
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-valid-until">Valid Until</Label>
                  <Input
                    id="sc-valid-until"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    placeholder="Dec 2026"
                    maxLength={50}
                  />
                </div>
              </div>
            </>
          )}

          {/* Membership-specific fields */}
          {programType === "MEMBERSHIP" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="sc-tier">Tier Name</Label>
                <Input
                  id="sc-tier"
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  placeholder="VIP Gold"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc-benefits">Benefits</Label>
                <Input
                  id="sc-benefits"
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  placeholder="Priority seating, 10% off all orders"
                  maxLength={200}
                />
              </div>
            </>
          )}

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
