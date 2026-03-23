# Future Ideas

Ideas to explore after core product is validated and launched.

---

## Digital Business Card ✅ IMPLEMENTED (Phase BUSINESS_CARD)

A 7th pass type (`BUSINESS_CARD`) replacing traditional printed business cards. One card per organization with company contact information, shareable via QR code or link. Recipients add it to their wallet (Apple/Google) as a contact card. Targets the same businesses already using Loyalshy — their sales reps/commercials hand out paper cards that get lost; this puts them in the client's wallet instead.

**Architecture — fits existing model:**
- **PassTemplate** = the business card design (company name, contact person, phone, email, website, socials)
- **PassInstance** = each recipient who adds it to their wallet (tracks distribution count)
- **Contact** = auto-created on scan (counts against plan contact limits)
- **No Interactions** — no stamps, points, check-ins. Just issued and done.
- One card per org — same card for everyone who receives it
- Same plan contact limits apply (Free: 50, Pro: 500, Business: 2,500, Scale: Unlimited)

**Why it works:**
- Reuses PassTemplate/PassInstance/Contact pipeline entirely
- Reuses wallet pass infrastructure (Apple Generic / Google Generic — already built)
- Reuses QR code generation and shareable link distribution
- Businesses already have branding assets in the system (logo, colors)
- Natural upsell: "You already use Loyalshy for loyalty. Now give your team digital business cards under the same brand."
- Not competing with Popl/HiHello (personal networking tools) — solving a different problem for existing customers
- Recipients with your business card in their wallet are one tap away from your loyalty programs

**Why to wait:**
- Core product must be validated and launched first
- Different use case (contact sharing vs. loyalty/retention) — build after product-market fit is confirmed

**Distribution channels (4 ways to share):**
- **Shareable link** — reuses existing `/join/[slug]` flow, share via messaging, email signature, etc.
- **QR code** — reuses existing QR generation, print on materials or show on phone screen
- **NFC** — program an NFC tag (phone case, desk stand) with the shareable URL
- **Website embed** — embeddable HTML snippet with Apple + Google Wallet buttons for websites, landing pages, or email signatures. Could be a simple badge link or a styled widget with both wallet buttons side by side.

**Solo worker use case:**
A freelancer or solo commercial signs up on Free plan (50 contacts), creates one Business Card, and shares it everywhere: link in email signature, QR on printed materials, NFC tag on phone case, embed buttons on personal website. Replaces paper business cards entirely.

**What's new (minimal scope):**
- `BUSINESS_CARD` added to PassType enum (7th type)
- Studio panel for business card fields (name, title, phone, email, website, social links)
- No reward/interaction UI for this type (hidden/disabled)
- vCard (.vcf) download fallback for non-wallet users
- Analytics: distribution count (how many times added to wallet)
- Embeddable widget/badge snippet (HTML with Apple + Google Wallet buttons) — generated in Distribution tab

**Estimated scope:** ~1 phase. Mostly reuses existing infrastructure with a new studio panel and simplified flow (no interactions).
