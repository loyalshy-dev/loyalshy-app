/* ─── Shared card data for marketing wallet visuals ───────────────── */

import { getTemplateById, type CardTemplate } from "@/lib/wallet/card-templates"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"

// ─── Types ──────────────────────────────────────────────

export type MarketingCard = {
  templateId: string
  restaurantName: string
  currentVisits: number
  totalVisits: number
  rewardDescription: string
  customerName: string
  memberSince: string
  // Coupon fields
  discountText?: string
  couponCode?: string
  validUntil?: string
  // Membership fields
  tierName?: string
  benefits?: string
}

// ─── Template → WalletPassDesign converter ──────────────

function templateToDesign(template: CardTemplate): WalletPassDesign {
  return {
    ...template.design,
    customProgressLabel: null,
    stripImageUrl: null,
  }
}

// ─── Marketing card data (5 visually diverse picks) ─────

export const MARKETING_CARDS: MarketingCard[] = [
  {
    templateId: "fine-gold",
    restaurantName: "Aurum Kitchen",
    currentVisits: 7,
    totalVisits: 10,
    rewardDescription: "Free tasting menu",
    customerName: "Sophie L.",
    memberSince: "Jan 2026",
  },
  {
    templateId: "stamp-grid-coffee",
    restaurantName: "Morning Grounds",
    currentVisits: 5,
    totalVisits: 8,
    rewardDescription: "Free latte",
    customerName: "Marcus W.",
    memberSince: "Nov 2025",
  },
  {
    templateId: "casual-bright",
    restaurantName: "Sunny Taco",
    currentVisits: 3,
    totalVisits: 10,
    rewardDescription: "BOGO burrito",
    customerName: "Elena R.",
    memberSince: "Feb 2026",
  },
  {
    templateId: "bar-neon",
    restaurantName: "Neon Lounge",
    currentVisits: 9,
    totalVisits: 12,
    rewardDescription: "Free cocktail",
    customerName: "James K.",
    memberSince: "Dec 2025",
  },
  {
    templateId: "bakery-sweet",
    restaurantName: "Miel Bakery",
    currentVisits: 4,
    totalVisits: 6,
    rewardDescription: "Free croissant",
    customerName: "Ava M.",
    memberSince: "Jan 2026",
  },
]

// ─── Pre-computed designs ───────────────────────────────

export const MARKETING_CARD_DESIGNS: WalletPassDesign[] = MARKETING_CARDS.map(
  (card) => {
    const template = getTemplateById(card.templateId)
    if (!template) throw new Error(`Template not found: ${card.templateId}`)
    return templateToDesign(template)
  },
)
