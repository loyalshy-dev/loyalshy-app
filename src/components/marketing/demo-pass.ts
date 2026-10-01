import type { WalletPassDesign } from "@/components/wallet-pass-renderer"
import { CORAL, INK } from "./tokens"

// The demo pass used by the hero and the customer-view scenes: a five-slot
// stamp card in the brand ink with coral stamps — the mark as a product.
// Same renderer as the studio and the join page, so it always looks like a
// real Loyalshy pass.

export const DEMO_PASS_DESIGN: WalletPassDesign = {
  cardType: "STAMP",
  showStrip: true,
  primaryColor: INK,
  secondaryColor: CORAL,
  textColor: "#FFFFFF",
  progressStyle: "NUMBERS",
  labelFormat: "UPPERCASE",
  customProgressLabel: null,
  stripImageUrl: null,
  stripFill: "flat",
  stripColor1: INK,
  stripColor2: INK,
  stampFilledColor: CORAL,
  patternStyle: "NONE",
  useStampGrid: true,
  fields: ["memberNumber", "nextReward", "totalVisits", "customerName"],
  stampGridConfig: {
    stampIcon: "coffee",
    customStampIconUrl: null,
    rewardIcon: "gift",
    customRewardIconUrl: null,
    customEmptyIconUrl: null,
    useUniformIcon: false,
    stampShape: "circle",
    filledStyle: "solid",
    stampIconScale: 0.55,
    useStripBackground: false,
    emptyNumberColor: "#FFFFFF",
    emptyNumberScale: 0.35,
    emptySlotOpacity: 0.55,
    emptySlotColor: CORAL,
    emptySlotBg: "transparent",
    rewardSlotColor: "#FFFFFF",
    rewardSlotBg: CORAL,
    rewardFilledStyle: "solid",
  },
}

// A small sun for "Café Sol": coral disc, white core and rays.
export const DEMO_PASS_LOGO =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${CORAL}"/><g stroke="#fff" stroke-width="4" stroke-linecap="round"><circle cx="32" cy="32" r="9" fill="#fff" stroke="none"/><path d="M32 12v6M32 46v6M12 32h6M46 32h6M18 18l4 4M42 42l4 4M46 18l-4 4M22 42l-4 4"/></g></svg>`,
  )

export const DEMO_PASS_TOTAL = 5
export const DEMO_PASS_STAMPS = 4
