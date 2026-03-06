# Pass Types — Flow & UX Guide

Loyalshy supports ten pass types across two categories: **loyalty** (5 types that existed pre-rewrite) and **utility** (5 new types). Each has a distinct contact journey, staff workflow, and wallet pass behavior.

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

### 5. Prepaid (`PREPAID`)

A prepaid pass with a fixed number of uses that counts down. Each use consumes one unit. Can be recharged. Think bus pass (15 rides), car wash card (5 washes), class pack (10 yoga sessions).

#### Configuration (`PrepaidConfig`)

| Field | Description |
|-------|-------------|
| totalUses | Starting balance (e.g., 15 rides, 5 washes) |
| useLabel | What each unit is called (e.g., "ride", "wash", "session", "class") |
| rechargeable | Whether the card can be topped up after purchase |
| rechargeAmount | Default top-up amount (e.g., +15 rides) |

#### Contact Journey

1. **Scan QR code** → receives pass with full starting balance (e.g., 15/15 rides)
2. **Add to wallet** — pass shows remaining uses prominently
3. **Each use** — staff registers a PREPAID_USE interaction
   - Balance decrements: 15 → 14 → 13 → ...
   - Pass updates immediately with new remaining count
4. **Low balance** — pass shows warning when running low (e.g., 2 remaining)
5. **Depleted (0 remaining)** — pass visually changes to "depleted" state
6. **Recharge** — if rechargeable, business registers a PREPAID_RECHARGE interaction (e.g., +15 rides). Pass reactivates

#### Staff Workflow

- **Use** → from register interaction dialog → select prepaid pass instance → confirm (-1 use)
- **Recharge** → from contact detail or pass instance detail → add uses → confirm
- Dashboard shows: remaining balance, usage history, depletion rate

#### Wallet Pass

- Apple: `storeCard` | Google: `LoyaltyClass/Object`
- Shows: remaining uses (e.g., "12 / 15"), use label, valid until, member since
- Progress bar/count depletes (opposite of stamp card — counts DOWN)
- Low balance state: visual warning (e.g., "2 rides remaining")
- Depleted state: grayed out, "0 remaining — Recharge needed"
- After recharge: pass reactivates with new balance

#### Key Distinction

Prepaid is a **consumable balance** — each use costs one unit. Unlike membership (where check-ins are just statistics), prepaid uses actually **deplete the card**. Unlike stamp cards (which count up toward a reward), prepaid counts **down toward zero**. The card can be recharged to start over.

---

## Utility Pass Types

### 6. Gift Card (`GIFT_CARD`)

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

### 7. Ticket (`TICKET`)

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

### 8. Access (`ACCESS`)

A facility or area access pass with optional time restrictions.

#### Configuration (`AccessConfig`)

| Field | Description |
|-------|-------------|
| accessLabel | What is being accessed (e.g., "Building A", "VIP Lounge") |
| validDays | Which days of the week the pass is valid |
| validTimeStart | Start of daily valid window (e.g., "09:00") |
| validTimeEnd | End of daily valid window (e.g., "17:00") |
| validDuration | How long the pass is valid (`monthly`, `yearly`, etc.) |
| maxDailyUses | Maximum uses per day |

#### Contact Journey

1. **Receives access pass** → pass instance created
2. **Add to wallet** — pass shows access area and validity
3. **Present pass** — contact shows pass at access point
4. **Grant/deny** — staff registers ACCESS_GRANT or ACCESS_DENY interaction

#### Wallet Pass

- Apple: `generic` | Google: `GenericClass/Object`
- Shows: access area, valid hours, valid days, status

---

### 9. Transit (`TRANSIT`)

A boarding pass for transportation services.

#### Configuration (`TransitConfig`)

| Field | Description |
|-------|-------------|
| transitType | Type of transit (bus, train, ferry, flight, etc.) |
| originName | Departure location |
| destinationName | Arrival location |
| departureDateTime | Departure date and time |
| barcodeType | Barcode format |

#### Contact Journey

1. **Receives transit pass** → pass instance created with route details
2. **Add to wallet** — pass shows origin, destination, departure time
3. **Board** — TRANSIT_BOARD interaction registered at departure
4. **Exit** — TRANSIT_EXIT interaction registered at arrival

#### Wallet Pass

- Apple: `boardingPass` | Google: `TransitClass/Object`
- Shows: origin, destination, departure time, transit type, barcode

---

### 10. Business ID (`BUSINESS_ID`)

An employee or member identification card.

#### Configuration (`BusinessIdConfig`)

| Field | Description |
|-------|-------------|
| idLabel | What the ID represents (e.g., "Employee ID", "Student ID") |
| showTitle | Whether to display job title |
| showPhoto | Whether to display photo |
| showEmployeeId | Whether to display an ID number |
| validDuration | How long the ID is valid |

#### Contact Journey

1. **Receives ID** → pass instance created with identity details
2. **Add to wallet** — pass serves as digital ID
3. **Verification** — staff registers an ID_VERIFY interaction when identity is checked

#### Wallet Pass

- Apple: `generic` | Google: `GenericClass/Object`
- Shows: name, title, department, ID number, photo, organization

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

### Loyalty Types

| Feature | Stamp Card | Coupon | Membership | Points | Prepaid |
|---------|-----------|--------|------------|--------|---------|
| Interaction tracking | Yes (stamps) | No | Yes (check-ins) | Yes (earns points) | Yes (uses consumed) |
| Balance/progress | Counts UP to N | N/A | N/A (stats only) | Earns/spends | Counts DOWN from N |
| Reward cycle | After N stamps | Immediate | None | Catalog redemption | None |
| Rechargeable | N/A (auto-cycles) | N/A | N/A (renew) | N/A (earns more) | Yes (top up uses) |
| Minigame support | Yes | Yes | No | No | No |
| Staff action | Register Stamp | Redeem Coupon | Check In | Earn/Redeem Points | Use / Recharge |
| Ends when | Cycles forever | Redeemed or expired | Business cancels | Never | Depleted (reloadable) |

### Utility Types

| Feature | Gift Card | Ticket | Access | Transit | Business ID |
|---------|-----------|--------|--------|---------|-------------|
| Primary use | Monetary balance | Event entry | Facility access | Boarding | Identity |
| Balance/state | Currency amount | Scan count | Grant/deny log | Board/exit | Verification log |
| Consumable | Yes (money) | Yes (scans) | No (log only) | Yes (one trip) | No (log only) |
| Apple pass style | storeCard | eventTicket | generic | boardingPass | generic |
| Google pass class | GiftCard | EventTicket | Generic | Transit | Generic |

---

## Pass Instance Lifecycle

All pass types share the same pass instance statuses:

```
ACTIVE → COMPLETED (stamp card cycle done / single coupon redeemed / prepaid depleted / ticket used)
ACTIVE → SUSPENDED (membership suspended by business)
ACTIVE → EXPIRED (membership or prepaid expiry reached / ticket event passed)
ACTIVE → REVOKED (business revokes the pass)
ACTIVE → VOIDED (ticket voided / gift card cancelled)
ACTIVE → (keeps going for unlimited coupons, memberships, points, and recharged prepaid)
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
| Bus pass, car wash, class pack, session bundle | Prepaid |
| Store credit, birthday gift, employee reward | Gift Card |
| Concerts, conferences, sports events | Ticket |
| Building entry, VIP areas, parking | Access |
| Bus/train/ferry/flight boarding | Transit |
| Employee badges, student IDs, member cards | Business ID |
