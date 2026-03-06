"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Plus,
  Paintbrush,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { WalletPassRenderer } from "@/components/wallet-pass-renderer"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"
import { Card } from "@/components/ui/card"
import { ShowcaseCardForm } from "./showcase-card-form"
import {
  deleteShowcaseCard,
  reorderShowcaseCards,
  type ShowcaseMetadata,
} from "@/server/showcase-actions"

type ShowcaseCard = {
  id: string
  designData: unknown
  metadata: unknown
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

type Props = {
  initialCards: ShowcaseCard[]
}

const MAX_CARDS = 5
const CARD_W = 220
const CARD_H = Math.round(CARD_W * (11 / 8))

function designDataToWalletDesign(data: unknown): WalletPassDesign {
  const d = (data ?? {}) as Record<string, unknown>
  return {
    cardType: (d.cardType as WalletPassDesign["cardType"]) ?? "STAMP",
    showStrip: (d.showStrip as boolean) ?? true,
    primaryColor: (d.primaryColor as string) ?? "#1a1a2e",
    secondaryColor: (d.secondaryColor as string) ?? "#ffffff",
    textColor: (d.textColor as string) ?? "#ffffff",
    progressStyle: (d.progressStyle as WalletPassDesign["progressStyle"]) ?? "NUMBERS",
    labelFormat: (d.labelFormat as WalletPassDesign["labelFormat"]) ?? "UPPERCASE",
    customProgressLabel: (d.customProgressLabel as string) ?? null,
    stripImageUrl: (d.stripImageUrl as string) ?? null,
    patternStyle: (d.patternStyle as WalletPassDesign["patternStyle"]) ?? "NONE",
    stripOpacity: (d.editorConfig as Record<string, unknown>)?.stripOpacity as number | undefined,
    stripGrayscale: (d.editorConfig as Record<string, unknown>)?.stripGrayscale as boolean | undefined,
    stripColor1: (d.editorConfig as Record<string, unknown>)?.stripColor1 as string | undefined,
    stripColor2: (d.editorConfig as Record<string, unknown>)?.stripColor2 as string | undefined,
    stripFill: (d.editorConfig as Record<string, unknown>)?.stripFill as WalletPassDesign["stripFill"],
    patternColor: (d.editorConfig as Record<string, unknown>)?.patternColor as string | undefined,
    useStampGrid: (d.editorConfig as Record<string, unknown>)?.useStampGrid as boolean | undefined,
    stampGridConfig: (d.editorConfig as Record<string, unknown>)?.stampGridConfig as WalletPassDesign["stampGridConfig"],
    stripImagePosition: (d.editorConfig as Record<string, unknown>)?.stripImagePosition as { x: number; y: number } | undefined,
    stripImageZoom: (d.editorConfig as Record<string, unknown>)?.stripImageZoom as number | undefined,
  }
}

function getMetadata(card: ShowcaseCard): ShowcaseMetadata {
  const m = (card.metadata ?? {}) as Record<string, unknown>
  return {
    organizationName: (m.organizationName as string) ?? (m.restaurantName as string) ?? "Organization",
    customerName: (m.customerName as string) ?? "Customer",
    memberSince: (m.memberSince as string) ?? "Jan 2026",
    currentVisits: (m.currentVisits as number) ?? 5,
    totalVisits: (m.totalVisits as number) ?? 10,
    rewardDescription: (m.rewardDescription as string) ?? "Free reward",
    discountText: (m.discountText as string) ?? "",
    couponCode: (m.couponCode as string) ?? "",
    validUntil: (m.validUntil as string) ?? "",
    tierName: (m.tierName as string) ?? "",
    benefits: (m.benefits as string) ?? "",
  }
}

export function ShowcaseCardsView({ initialCards }: Props) {
  const [cards, setCards] = useState(initialCards)
  const [formOpen, setFormOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<ShowcaseCard | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  async function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteShowcaseCard(id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        setCards((prev) => prev.filter((c) => c.id !== id))
        toast.success("Card deleted")
        router.refresh()
      }
    })
  }

  async function handleMove(id: string, direction: "up" | "down") {
    const idx = cards.findIndex((c) => c.id === id)
    if (idx < 0) return
    const newIdx = direction === "up" ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= cards.length) return

    const reordered = [...cards]
    ;[reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]]
    setCards(reordered)

    startTransition(async () => {
      const result = await reorderShowcaseCards(reordered.map((c) => c.id))
      if ("error" in result) {
        toast.error(String(result.error))
        setCards(initialCards) // revert
      }
    })
  }

  function handleFormSuccess() {
    setFormOpen(false)
    setEditingCard(null)
    router.refresh()
  }

  return (
    <div>
      {/* Card grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => {
          const meta = getMetadata(card)
          const design = designDataToWalletDesign(card.designData)

          return (
            <Card
              key={card.id}
              className="group relative p-4"
            >
              {/* Card preview */}
              <div className="mb-3 flex justify-center">
                <WalletPassRenderer
                  design={design}
                  compact
                  width={CARD_W}
                  height={CARD_H}
                  format="apple"
                  organizationName={meta.organizationName}
                  currentVisits={meta.currentVisits}
                  totalVisits={meta.totalVisits}
                  rewardDescription={meta.rewardDescription}
                  customerName={meta.customerName}
                  memberSince={meta.memberSince}
                  discountText={meta.discountText || undefined}
                  couponCode={meta.couponCode || undefined}
                  validUntil={meta.validUntil || undefined}
                  tierName={meta.tierName || undefined}
                  benefits={meta.benefits || undefined}
                />
              </div>

              {/* Metadata */}
              <div className="mb-3 space-y-0.5">
                <p className="text-sm font-medium">{meta.organizationName}</p>
                <p className="text-xs text-muted-foreground">
                  {design.cardType === "COUPON"
                    ? `${meta.discountText || "Coupon"} ${meta.couponCode ? `· ${meta.couponCode}` : ""}`
                    : design.cardType === "TIER"
                      ? `${meta.tierName || "Member"} ${meta.benefits ? `· ${meta.benefits}` : ""}`
                      : `${meta.currentVisits}/${meta.totalVisits} visits · ${meta.rewardDescription}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  asChild
                >
                  <Link href={`/admin/showcase/${card.id}/studio`}>
                    <Paintbrush className="size-3" />
                    Design
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    setEditingCard(card)
                    setFormOpen(true)
                  }}
                >
                  <Pencil className="size-3" />
                  Info
                </Button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={i === 0 || isPending}
                  onClick={() => handleMove(card.id, "up")}
                  aria-label="Move up"
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={i === cards.length - 1 || isPending}
                  onClick={() => handleMove(card.id, "down")}
                  aria-label="Move down"
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      aria-label="Delete card"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete showcase card?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the card from the landing page.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(card.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          )
        })}

        {/* Add card button */}
        {cards.length < MAX_CARDS && (
          <button
            onClick={() => {
              setEditingCard(null)
              setFormOpen(true)
            }}
            className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 p-4 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            <Plus className="size-8" strokeWidth={1.5} />
            <span className="text-sm font-medium">Add Card</span>
            <span className="text-xs">{cards.length}/{MAX_CARDS} cards</span>
          </button>
        )}
      </div>

      {cards.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No showcase cards yet. Add cards to customize the marketing landing page.
        </p>
      )}

      {/* Form dialog */}
      <ShowcaseCardForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editCard={editingCard}
        onSuccess={handleFormSuccess}
      />
    </div>
  )
}
