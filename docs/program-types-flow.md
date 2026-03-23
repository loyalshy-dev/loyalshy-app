# Pass Types — Flow & UX Guide

Loyalshy supports six pass types across two categories: **loyalty** (4 types) and **commerce/event** (2 types). Each has a distinct contact journey, staff workflow, and wallet pass behavior.

---

## Loyalty Pass Types

### 1. Stamp Card (`STAMP_CARD`)

The classic "buy 10, get 1 free" loyalty card.

#### Configuration (`StampCardConfig`)

| Field | Description |
|-------|-------------|
| stampsRequired | Number of stamps to earn a reward (e.g., 10) |
| rewardDescription | What the contact gets (e.g., "Free coffee") |
| rewardExpiryDays | Days until an earned reward expires |
| minigame | Optional — scratch card, slots, or wheel of fortune |

#### Contact Journey

1. **Scan QR code** → receives a pass instance for the template
2. **Add to wallet** — Apple Wallet or Google Wallet pass is created
3. **Each interaction** — staff registers a STAMP interaction, stamp count increments
4. **Earn reward** — after N stamps, a reward is created automatically
   - Without minigame: reward is immediately visible ("You earned: Free coffee!")
   - With minigame: a random prize is assigned but hidden (`revealedAt: null`). Contact opens the card page and plays the minigame to reveal their prize
5. **Redeem reward** — staff marks the reward as redeemed from the dashboard
6. **Cycle resets** — stamp count goes back to 0, contact starts earning again

#### Staff Workflow

- **Register Interaction** dialog → search contact → confirm stamp → animation plays
- If contact reaches the goal → reward celebration screen
- **Redeem Reward** → from rewards tab or contact detail sheet

#### Wallet Pass

- Apple: `storeCard` | Google: `LoyaltyClass/Object`
- Shows: progress (e.g., "7/10"), total stamps, next reward, member since
- Updates after each stamp (stamp grid image regenerated for Google)
- When reward earned with minigame: "Reveal your prize!" link appears on pass
- After reveal: shows "YOUR PRIZE: [prize name]"

---

### 2. Coupon (`COUPON`)

A digital coupon — discount, fixed amount off, or free item.

#### Configuration (`CouponConfig`)

| Field | Description |
|-------|-------------|
| discountType | `percentage`, `fixed`, or `freebie` |
| discountValue | Amount (e.g., 20 for 20%) — ignored for freebie |
| couponCode | Optional display code (e.g., "SAVE20") |
| validUntil | Expiry date for the coupon |
| redemptionLimit | `single` (one-time) or `unlimited` (reusable) |
| minigame | Optional — replaces fixed discount with random prizes |

#### Contact Journey

1. **Scan QR code** → receives a pass instance for the coupon template
2. **Reward created immediately** — unlike stamp cards, no interactions needed
   - Without minigame: coupon is ready to use right away
   - With minigame: a random prize is assigned at issuance. Contact plays the minigame on the card page to discover what they won (e.g., "10% off", "20% off", or "Free dessert")
3. **Add to wallet** — pass shows discount/prizes and validity
4. **Redeem coupon** — contact brings coupon to business, staff redeems it
   - Single use: pass instance status becomes `COMPLETED`
   - Unlimited: a new reward is created (with a new random prize if minigame is enabled)

#### Staff Workflow

- **Redeem Coupon** → from register interaction dialog → select the coupon pass instance → confirm
- Dashboard shows coupon status (available, redeemed, expired)

#### Wallet Pass

- Apple: `storeCard` | Google: `LoyaltyClass/Object`
- Without minigame: shows discount value (e.g., "20% off"), valid until, coupon code
- With minigame (before reveal): shows "PRIZES: 10%, 20%, 30%" (all possible prizes)
- With minigame (after reveal): shows "YOUR PRIZE: 20%" (the won prize)
- After redemption: pass updates to reflect redeemed status

#### Minigame Flow (Coupon)

```
Pass issued → Prize assigned (hidden) → Contact plays minigame → Prize revealed
                                                                        |
                                            Contact brings to business → Staff redeems
```

---

### 3. Membership (`MEMBERSHIP`)

A digital ID card used to identify clients. Managed entirely by the business — the contact presents the pass, staff checks them in. Think gym pass, library card, student ID, club membership.

#### Configuration (`MembershipConfig`)

| Field | Description |
|-------|-------------|
| membershipTier | Tier/plan name (e.g., "Premium", "Gold", "Student") |
| benefits | Description of what the membership includes |
| validDuration | `monthly`, `yearly`, `lifetime`, or `custom` (N days) |
| autoRenew | Whether membership auto-renews on expiry or requires manual renewal |

#### Contact Journey

1. **Scan QR code** → receives a membership pass (or business adds them from dashboard)
2. **Add to wallet** — pass serves as their **digital ID card**
3. **Present pass** — contact shows the pass at the business (gym entrance, library desk, etc.)
4. **Staff checks in** — staff registers a CHECK_IN interaction (for usage statistics)
5. **Membership is ongoing** — no rewards cycle, no balance to consume. The pass IS the product
6. **Expiry/renewal** — when membership expires, pass status changes. Business renews or cancels from dashboard

#### Staff Workflow

- **Check In** → from register interaction dialog → select membership pass instance → confirm
- Check-in is logged for statistics (visit frequency, peak hours, engagement metrics)
- **Manage membership** → from dashboard: activate, suspend, cancel, renew
- Contact cannot self-cancel — must contact the business

#### Wallet Pass

- Apple: `generic` | Google: `GenericClass/Object`
- Shows: member name, tier/plan, status (Active/Suspended/Expired), benefits, member since, expiry date
- Updates when: status changes, tier changes, check-in count increments
- Visually changes on status: Active (normal), Suspended (dimmed), Expired (grayed out)

#### Key Distinction

Membership is an **identity card**, not a consumable. Check-ins don't deplete anything — they generate usage data for the business. The business has full control over the membership lifecycle.

---

### 4. Points (`POINTS`)

Earn points per interaction, redeem from a reward catalog.

#### Configuration (`PointsConfig`)

| Field | Description |
|-------|-------------|
| pointsPerVisit | How many points earned per interaction (e.g., 10) |
| catalog | List of items with name and points cost (e.g., "Free coffee — 100 pts") |
| pointsLabel | Optional custom label (e.g., "stars", "coins") |

#### Contact Journey

1. **Scan QR code** → receives a points pass instance
2. **Add to wallet** — pass shows points balance, earn rate, next reward
3. **Each interaction** — staff registers a POINTS_EARN interaction, contact earns points (e.g., +10 pts)
4. **Browse catalog** — contact (or staff) sees available rewards and their costs
5. **Redeem reward** — when balance is sufficient, staff registers a POINTS_REDEEM interaction
   - Points are deducted from balance
   - Reward is recorded with the catalog item name and cost

#### Staff Workflow

- **Earn Points** → from register interaction dialog → select points pass instance → confirm (+N points)
- **Redeem Points** → from register interaction dialog → select catalog item → confirm (deducts points)

#### Wallet Pass

- Apple: `storeCard` | Google: `LoyaltyClass/Object`
- Shows: points balance, earn rate (e.g., "10 points per visit"), next cheapest reward, member since
- Updates after each earn/redeem (balance changes)

---

## Commerce & Event Pass Types

### 5. Gift Card (`GIFT_CARD`)

A monetary balance card with partial or full redemption.

#### Configuration (`GiftCardConfig`)

| Field | Description |
|-------|-------------|
| currency | Currency code (e.g., "USD", "EUR") |
| initialBalanceCents | Starting balance in cents (e.g., 5000 = $50.00) |
| partialRedemption | Whether partial amounts can be charged |
| expiryMonths | Optional months until expiry |

#### Contact Journey

1. **Receives gift card** → pass instance created with initial balance
2. **Add to wallet** — pass shows monetary balance
3. **Each purchase** — staff registers a GIFT_CHARGE interaction with amount
   - Balance decreases by charged amount
4. **Refund** — staff registers a GIFT_REFUND interaction to credit back
5. **Depleted** — when balance reaches $0, pass shows depleted state

#### Staff Workflow

- **Charge** → enter amount → confirm (deducts from balance)
- **Refund** → enter amount → confirm (credits back to balance)

#### Wallet Pass

- Apple: `storeCard` | Google: `GiftCardClass/Object`
- Shows: remaining balance (formatted with currency), initial balance, card number

---

### 6. Ticket (`TICKET`)

An event entry pass with scan tracking.

#### Configuration (`TicketConfig`)

| Field | Description |
|-------|-------------|
| eventName | Name of the event |
| eventDate | Date and time of the event |
| eventVenue | Location/venue name |
| barcodeType | Barcode format (QR, PDF417, etc.) |
| maxScans | Maximum number of times the ticket can be scanned |

#### Contact Journey

1. **Receives ticket** → pass instance created for the event
2. **Add to wallet** — pass shows event details and barcode
3. **Event entry** — staff scans the ticket (TICKET_SCAN interaction)
   - Scan count tracked against maxScans
4. **Void** — ticket can be voided via TICKET_VOID interaction

#### Staff Workflow

- **Scan** → scan barcode or search contact → confirm entry
- **Void** → cancel ticket (e.g., refund, no-show)

#### Wallet Pass

- Apple: `eventTicket` | Google: `EventTicketClass/Object`
- Shows: event name, date, venue, seat/section, barcode

---

## Prize Reveal Minigame

Available for **Stamp Card** and **Coupon** templates only.

### Game Types

| Type | Description |
|------|-------------|
| Scratch Card | Contact scratches to reveal prize |
| Slot Machine | Spinning reels that land on the prize |
| Wheel of Fortune | Spinning wheel with prize segments |

### Configuration

- **Prizes**: 1-8 prizes, each with a name and weight (1-10)
- **Weights**: Higher weight = higher probability. Displayed as percentages in the editor
- **Colors**: Customizable primary and accent colors for the game UI

### How It Works

| Template | When Prize Is Assigned | When Contact Plays |
|----------|----------------------|---------------------|
| Stamp Card | When reward is earned (after N stamps) | On card page, before redeeming |
| Coupon | At pass issuance (immediately) | On card page, before redeeming |

### Wallet Pass Integration

1. **Before reveal**: Pass shows a "Reveal your prize!" link pointing to the card page
2. **Contact plays minigame**: Prize is revealed on the web card page
3. **After reveal**: Pass updates — link removed, prize shown as "YOUR PRIZE: [name]"
4. **Staff redeems**: Normal redemption flow

---

## Comparison Table

| Feature | Stamp Card | Coupon | Membership | Points | Gift Card | Ticket |
|---------|-----------|--------|------------|--------|-----------|--------|
| Interaction tracking | Yes (stamps) | No | Yes (check-ins) | Yes (earns points) | Yes (charges) | Yes (scans) |
| Balance/progress | Counts UP to N | N/A | N/A (stats only) | Earns/spends | Currency amount | Scan count |
| Reward cycle | After N stamps | Immediate | None | Catalog redemption | None | None |
| Minigame support | Yes | Yes | No | No | No | No |
| Staff action | Register Stamp | Redeem Coupon | Check In | Earn/Redeem Points | Charge/Refund | Scan/Void |
| Ends when | Cycles forever | Redeemed or expired | Business cancels | Never | Depleted | Event passed |
| Apple pass style | storeCard | storeCard | storeCard | storeCard | storeCard | eventTicket |

---

## Pass Instance Lifecycle

All pass types share the same pass instance statuses:

```
ACTIVE → COMPLETED (stamp card cycle done / single coupon redeemed / ticket used)
ACTIVE → SUSPENDED (membership suspended by business)
ACTIVE → EXPIRED (membership expiry reached / ticket event passed)
ACTIVE → REVOKED (business revokes the pass)
ACTIVE → VOIDED (ticket voided / gift card cancelled)
ACTIVE → (keeps going for unlimited coupons, memberships, and points)
```

### Wallet Pass Providers

Each pass instance can have one wallet pass:
- `NONE` — no wallet pass
- `APPLE` — Apple Wallet (.pkpass)
- `GOOGLE` — Google Wallet (via JWT save URL)

Pass updates are triggered via Trigger.dev background jobs (production) or direct API calls (development fallback).

---

## Pass Type Selection Guide

| Use Case | Recommended Type |
|----------|-----------------|
| Coffee shop, sandwich bar, bakery | Stamp Card |
| Promotional campaign, seasonal discount | Coupon |
| Gym, library, club, campus, coworking | Membership |
| Restaurant with varied rewards, loyalty program | Points |
| Store credit, birthday gift, employee reward | Gift Card |
| Concerts, conferences, sports events | Ticket |
