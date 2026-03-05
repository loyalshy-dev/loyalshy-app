# Program Types — Flow & UX Guide

Loyalshy supports four program types. Each has a distinct customer journey, staff workflow, and wallet pass behavior.

---

## 1. Stamp Card (`STAMP_CARD`)

The classic "buy 10, get 1 free" loyalty card.

### Configuration

| Field | Description |
|-------|-------------|
| Visits Required | Number of stamps to earn a reward (e.g., 10) |
| Reward Description | What the customer gets (e.g., "Free coffee") |
| Reward Expiry Days | Days until an earned reward expires |
| Prize Reveal Minigame | Optional — scratch card, slots, or wheel of fortune |

### Customer Journey

1. **Scan QR code** at the restaurant → enrolls in the program
2. **Add to wallet** — Apple Wallet or Google Wallet pass is created
3. **Each visit** — staff registers a visit from the dashboard, stamp count increments
4. **Earn reward** — after N visits, a reward is created automatically
   - Without minigame: reward is immediately visible ("You earned: Free coffee!")
   - With minigame: a random prize is assigned but hidden (`revealedAt: null`). Customer opens the card page and plays the minigame to reveal their prize
5. **Redeem reward** — staff marks the reward as redeemed from the dashboard
6. **Cycle resets** — stamp count goes back to 0, customer starts earning again

### Staff Workflow

- **Register Visit** dialog → search customer → confirm stamp → animation plays
- If customer reaches the goal → reward celebration screen
- **Redeem Reward** → from rewards tab or customer detail sheet

### Wallet Pass

- Shows: progress (e.g., "7/10"), total visits, next reward, member since
- Updates after each visit (stamp grid image regenerated for Google)
- When reward earned with minigame: "Reveal your prize!" link appears on pass
- After reveal: shows "YOUR PRIZE: [prize name]"

---

## 2. Coupon (`COUPON`)

A digital coupon — discount, fixed amount off, or free item.

### Configuration

| Field | Description |
|-------|-------------|
| Discount Type | `percentage`, `fixed`, or `freebie` |
| Discount Value | Amount (e.g., 20 for 20%) — ignored for freebie |
| Coupon Code | Optional display code (e.g., "SAVE20") |
| Valid Until | Expiry date for the coupon |
| Redemption Limit | `single` (one-time) or `unlimited` (reusable) |
| Prize Reveal Minigame | Optional — replaces fixed discount with random prizes |

### Customer Journey

1. **Scan QR code** → enrolls in the coupon program
2. **Reward created immediately** — unlike stamp cards, no visits needed
   - Without minigame: coupon is ready to use right away
   - With minigame: a random prize is assigned at enrollment. Customer plays the minigame on the card page to discover what they won (e.g., "10% off", "20% off", or "Free dessert")
3. **Add to wallet** — pass shows discount/prizes and validity
4. **Redeem coupon** — customer brings coupon to restaurant, staff redeems it
   - Single use: enrollment status becomes `COMPLETED`
   - Unlimited: a new reward is created (with a new random prize if minigame is enabled)

### Staff Workflow

- **Redeem Coupon** → from register-visit dialog → select the coupon enrollment → confirm
- Dashboard shows coupon status (available, redeemed, expired)

### Wallet Pass

- Without minigame: shows discount value (e.g., "20% off"), valid until, coupon code
- With minigame (before reveal): shows "PRIZES: 10%, 20%, 30%" (all possible prizes)
- With minigame (after reveal): shows "YOUR PRIZE: 20%" (the won prize)
- After redemption: pass updates to reflect redeemed status

### Minigame Flow (Coupon)

```
Enrollment → Prize assigned (hidden) → Customer plays minigame → Prize revealed
                                                                        ↓
                                            Customer brings to restaurant → Staff redeems
```

---

## 3. Membership (`MEMBERSHIP`)

An ongoing membership card with check-ins — no rewards cycle.

### Configuration

| Field | Description |
|-------|-------------|
| Membership Tier | Tier name (e.g., "VIP", "Gold", "Premium") |
| Benefits | Description of membership benefits |
| Duration | `monthly`, `yearly`, `lifetime`, or `custom` (N days) |
| Prize Reveal Minigame | Not supported for membership |

### Customer Journey

1. **Scan QR code** → enrolls as a member
2. **Add to wallet** — pass shows tier, benefits, member since date
3. **Check-ins** — staff registers each visit as a "check-in"
4. **No rewards cycle** — check-ins are tracked for engagement metrics only
5. **Membership provides access** to tier-based benefits (managed outside the app)

### Staff Workflow

- **Check In Member** → from register-visit dialog → select membership enrollment → confirm
- Check-in count increments, no reward logic

### Wallet Pass

- Shows: tier name, check-in count, benefits, member since
- Updates after each check-in (counter increments)

---

## 4. Points (`POINTS`)

Earn points per visit, redeem from a reward catalog.

### Configuration

| Field | Description |
|-------|-------------|
| Points Per Visit | How many points earned per visit (e.g., 10) |
| Reward Catalog | List of items with name and points cost (e.g., "Free coffee — 100 pts") |
| Prize Reveal Minigame | Not supported for points |

### Customer Journey

1. **Scan QR code** → enrolls in the points program
2. **Add to wallet** — pass shows points balance, earn rate, next reward
3. **Each visit** — staff registers a visit, customer earns points (e.g., +10 pts)
4. **Browse catalog** — customer (or staff) sees available rewards and their costs
5. **Redeem reward** — when balance is sufficient, staff redeems a catalog item
   - Points are deducted from balance
   - Reward is recorded with the catalog item name and cost

### Staff Workflow

- **Earn Points** → from register-visit dialog → select points enrollment → confirm (+N points)
- **Redeem Points** → from register-visit dialog → select catalog item → confirm (deducts points)

### Wallet Pass

- Shows: points balance, earn rate (e.g., "10 points per visit"), next cheapest reward, member since
- Updates after each earn/redeem (balance changes)

---

## Prize Reveal Minigame

Available for **Stamp Card** and **Coupon** programs only.

### Game Types

| Type | Description |
|------|-------------|
| Scratch Card | Customer scratches to reveal prize |
| Slot Machine | Spinning reels that land on the prize |
| Wheel of Fortune | Spinning wheel with prize segments |

### Configuration

- **Prizes**: 1–8 prizes, each with a name and weight (1–10)
- **Weights**: Higher weight = higher probability. Displayed as percentages in the editor
- **Colors**: Customizable primary and accent colors for the game UI

### How It Works

| Program | When Prize Is Assigned | When Customer Plays |
|---------|----------------------|---------------------|
| Stamp Card | When reward is earned (after N visits) | On card page, before redeeming |
| Coupon | At enrollment (immediately) | On card page, before redeeming |

### Wallet Pass Integration

1. **Before reveal**: Pass shows a "Reveal your prize!" link pointing to the card page
2. **Customer plays minigame**: Prize is revealed on the web card page
3. **After reveal**: Pass updates — link removed, prize shown as "YOUR PRIZE: [name]"
4. **Staff redeems**: Normal redemption flow

---

## Comparison Table

| Feature | Stamp Card | Coupon | Membership | Points |
|---------|-----------|--------|------------|--------|
| Visit tracking | Yes (stamps) | No | Yes (check-ins) | Yes (earns points) |
| Reward cycle | After N visits | Immediate | None | Catalog redemption |
| Reward reset | Stamps reset to 0 | Single or unlimited | N/A | Points deducted |
| Minigame support | Yes | Yes | No | No |
| Wallet pass fields | Progress, total visits, next reward | Discount, valid until, code | Tier, check-ins, benefits | Balance, earn rate, next reward |
| Staff action | Register Visit | Redeem Coupon | Check In | Earn Points / Redeem Points |

---

## Enrollment Lifecycle

All program types share the same enrollment statuses:

```
ACTIVE → COMPLETED (stamp card cycle done / single coupon redeemed)
ACTIVE → FROZEN (staff or system freeze)
ACTIVE → (keeps going for unlimited coupons, memberships, and points)
```

### Wallet Pass Types

Each enrollment can have one wallet pass:
- `NONE` — no wallet pass
- `APPLE` — Apple Wallet (.pkpass)
- `GOOGLE` — Google Wallet (Loyalty pass via JWT)

Pass updates are triggered via Trigger.dev background jobs (production) or direct API calls (development fallback).
