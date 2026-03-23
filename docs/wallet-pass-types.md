# Wallet Pass Types — Apple & Google Generation Reference

How each of the 6 pass types maps to Apple/Google Wallet classes, field placement, config schemas, and visual quirks.

---

## Architecture Overview

- **Apple Wallet** uses 3 PKPass styles: `storeCard`, `eventTicket`, `generic`
- **Google Wallet** uses `Loyalty` class for ALL 6 types (unified approach, not per-type classes)
- All passes include QR barcode, contact info back field, and Loyalshy branding
- Strip image is optional per design; stamp grid PNGs are generated and uploaded to R2

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/wallet/apple/generate-pass.ts` | Apple .pkpass generation (passkit-generator) |
| `src/lib/wallet/google/generate-pass.ts` | Google Wallet JWT + class/object creation |
| `src/lib/wallet/card-design.ts` | Field definitions per pass type × platform |
| `src/lib/pass-config.ts` | Zod schemas + parsers for type-specific config |
| `src/components/wallet-pass-renderer/index.tsx` | Web preview renderer (studio, dashboard, distribution) |
| `src/types/pass-types.ts` | PassType enum, interaction types, config types |

---

## Pass Type → Platform Mapping

| Pass Type | Card Type | Apple Style | Google Class | Notes |
|-----------|-----------|-------------|--------------|-------|
| STAMP_CARD | STAMP | storeCard | Loyalty | Stamp grid, progress styles |
| COUPON | COUPON | storeCard | Loyalty | Minigame support |
| MEMBERSHIP | TIER | storeCard | Loyalty | Tier-based |
| POINTS | POINTS | storeCard | Loyalty | Points catalog |
| GIFT_CARD | GIFT_CARD | storeCard | Loyalty | Currency balance |
| TICKET | TICKET | eventTicket | Loyalty | Square corners, notch |

---

## 1. STAMP_CARD

### Config Schema
```
stampsRequired: number (2–50)
rewardDescription: string (1–200)
rewardExpiryDays: number (1–365)
minigame?: { enabled, gameType: "scratch"|"slots"|"wheel", prizes[], primaryColor, accentColor }
```

### Apple (storeCard)
| Section | Fields |
|---------|--------|
| Header | memberNumber, organization |
| Primary | progress (hidden if strip shown) |
| Secondary | nextReward, totalVisits, memberSince, customerName |
| Back | programInfo, currentProgress, memberNumber, memberSince, terms, contact, socials, revealLink |

### Google (Loyalty)
| Section | Fields |
|---------|--------|
| Primary Points | PROGRESS / STATUS = formatProgressValue() |
| Secondary Points | TOTAL VISITS = int balance |
| Card Row | (nextReward \| memberSince) |
| Hero Image | Organization logo or stamp grid PNG (uploaded to R2) |

### Visual Quirks
- Strip styles: DOTS, WAVES, GEOMETRIC, CHEVRON, CROSSHATCH, DIAMONDS, CONFETTI, SOLID_PRIMARY, SOLID_SECONDARY, STAMP_GRID
- Progress styles: NUMBERS, CIRCLES, SQUARES, STARS, STAMPS, PERCENTAGE, REMAINING
- Stamp grid: icon selection (Lucide), shape (circle/rounded-square/square), filled style

---

## 2. COUPON

### Config Schema
```
discountType: "percentage" | "fixed" | "freebie"
discountValue: number (0–10000)
couponCode?: string (max 50)
couponDescription?: string (max 200)
validUntil?: string (ISO date)
redemptionLimit: "single" | "unlimited"
terms?: string (max 5000)
minigame?: { ... }
```

### Apple (storeCard)
| Section | Fields |
|---------|--------|
| Header | organization |
| Primary | discount (e.g., "20% OFF", "$5 off", "Free item") |
| Secondary | validUntil, couponCode, customerName |
| Back | couponDetails, redemptionCode, redemptionInstructions, terms, contact |

### Google (Loyalty)
| Section | Fields |
|---------|--------|
| Primary Points | DISCOUNT / PRIZES = formatted discount text |
| Secondary Points | VALID UNTIL = date string |
| Card Row | (discount \| validUntil), (couponCode \| memberSince) |

---

## 3. MEMBERSHIP

### Config Schema
```
membershipTier: string (1–50)
benefits: string (max 2000)
validDuration: "monthly" | "yearly" | "lifetime" | "custom"
customDurationDays?: number (1–3650)
autoRenew?: boolean
terms?: string (max 5000)
```

### Apple (storeCard)
| Section | Fields |
|---------|--------|
| Header | organization |
| Primary | tierName |
| Secondary | benefits, memberSince, customerName |
| Back | membershipTier, membershipBenefits, membershipTerms, contact |

### Google (Loyalty)
| Section | Fields |
|---------|--------|
| Primary Points | TIER = membershipTier |
| Secondary Points | CHECK-INS = int totalVisits |
| Card Row | (tier \| status), (benefits \| memberSince) |

---

## 4. POINTS

### Config Schema
```
pointsPerVisit: number (1–100)
catalog: [{ id, name (1–100), description? (max 200), pointsCost (1–100000) }] (1–20 items)
pointsLabel?: string (max 20)
```

### Apple (storeCard)
| Section | Fields |
|---------|--------|
| Header | memberNumber, organization |
| Primary | pointsBalance (hidden if strip shown) |
| Secondary | earnRate ("X pts/visit"), nextRewardPoints, memberSince |
| Back | pointsBalance, earnRate, rewardCatalog (multiline), contact |

### Google (Loyalty)
| Section | Fields |
|---------|--------|
| Primary Points | POINTS = int pointsBalance |
| Secondary Points | NEXT REWARD = cheapest catalog item, or TOTAL VISITS |
| Card Row | (earnRate \| memberSince) |

---

## 5. GIFT_CARD

### Config Schema
```
currency: string (1–3, e.g., "USD")
initialBalanceCents: number (100–10,000,000)
partialRedemption: boolean
expiryMonths?: number (1–120)
```

### Apple (storeCard)
| Section | Fields |
|---------|--------|
| Header | organization |
| Primary | giftBalance (e.g., "USD 25.00") |
| Secondary | giftInitial, customerName |
| Back | giftDetails, giftExpiry, giftUsage, contact |

### Google (Loyalty)
| Section | Fields |
|---------|--------|
| Primary Points | BALANCE = "USD 25.00" |
| Secondary Points | INITIAL VALUE = formatted amount |
| Card Row | (balance \| initialValue) |

---

## 6. TICKET

### Config Schema
```
eventName: string (1–200)
eventDate: string (ISO date)
eventVenue: string (1–200)
barcodeType: "qr" | "code128" | "pdf417" | "aztec"
maxScans: number (1–100)
```

### Apple (eventTicket)
| Section | Fields |
|---------|--------|
| Header | scanStatus (e.g., "0 / 1 SCANS") |
| Primary | eventName |
| Secondary | eventDate, eventVenue, customerName |
| Back | ticketEvent, ticketScans, contact |

### Google (Loyalty)
| Section | Fields |
|---------|--------|
| Primary Points | EVENT = eventName |
| Secondary Points | SCANS = "X / Y" |
| Card Row | (eventDate \| venue), (scans \| holder) |

### Visual Quirks
- **Apple:** Square corners (borderRadius: 0), notch cutout at top via CSS `mask-image: radial-gradient(ellipse)`, event name overlaid on strip image, no logo visible, smaller header fields (15px)
- **Web renderer:** `DeviceFrameWrapper` gets `squareCorners` prop, `FieldSection` gets `small` prop
- **Google renderer:** Event name as heading, 2-column field grid via `GoogleTicketFields` component

---

## Common Back Fields (Apple, All Types)

Every Apple pass includes these back fields when data is available:
- contact (organization name)
- businessHours
- mapAddress
- customMessage
- socials (website, phone, social links)
- revealLink (if unrevealed prize from minigame)
- poweredBy (Loyalshy branding)
- terms (if pass has terms configured)

## Common Google Features (All Types)

- **Barcode:** QR_CODE with walletPassId
- **Link Module:** Website, phone, social, map links
- **Hero Image:** Organization logo (or stamp grid PNG for stamp cards)
- **Design Hash:** SHA-256 for cache invalidation of class updates

## Card Design Customization (All Types)

- **primaryColor:** Falls back to organization.brandColor
- **secondaryColor:** Falls back to organization.secondaryColor
- **textColor:** Auto-computed for contrast
- **labelColor:** Optional override
- **labelFormat:** UPPERCASE / TITLE_CASE / LOWERCASE
- **stripImage:** Optional per-design, type-specific handling
- **logoText:** Organization name (hidden on Apple ticket cards)
