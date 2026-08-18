# Loyalshy — Digital Loyalty Platform for Small Businesses

Multi-tenant SaaS for cafés, salons, and small retail to run digital loyalty programs in Apple Wallet and Google Wallet. Two pass types: **stamp cards** (reward after N visits) and **coupons** (single-use or unlimited redeemable offers). Customers join via QR code, shareable link, direct issue, or email — no app install required.

A companion staff app ([loyalshy-staff](../loyalshy-staff)) lets employees scan passes and register stamps/redemptions from their phone.

## Tech Stack

Next.js 16 | React 19 | Prisma 7 | PostgreSQL 18 (Neon) | Better Auth | Stripe | Trigger.dev | Tailwind CSS 4 | shadcn/ui | next-intl (en/es/fr)

## Prerequisites

- Node.js 20+
- PostgreSQL 18 (Neon or local Docker)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

```bash
# Local PostgreSQL via Docker (or use a Neon branch)
docker run -d --name loyalshy-db \
  -e POSTGRES_USER=loyalshy \
  -e POSTGRES_PASSWORD=loyalshy \
  -e POSTGRES_DB=loyalshy \
  -p 5433:5432 \
  postgres:18

# Apply migrations
npx prisma migrate deploy

# Seed (optional)
npx prisma db seed
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values. See sections below for service-specific setup.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Organization** | Tenant — a business using the platform (Better Auth Organization) |
| **PassTemplate** | Program blueprint (e.g., "Coffee Stamp Card") |
| **PassInstance** | An issued pass — links a Contact to a PassTemplate |
| **Contact** | End user who receives passes |
| **Interaction** | Any event on a pass (stamp, redeem, reward, note) |

## Pass Types

| Type | Description | Staff action |
|------|-------------|--------------|
| STAMP_CARD | Collect stamps, earn rewards | `{ action: "stamp" }` |
| COUPON | Single-use or unlimited redeemable offer | `{ action: "redeem" }` |

---

## Google Wallet Setup (Free)

Google Wallet passes require a Google Cloud service account and an Issuer ID. No paid program is needed.

See **`docs/google-oauth-setup.md`** for detailed instructions, or follow the quick steps:

1. Create a Google Cloud project and enable the **Google Wallet API**
2. Create a service account and download the JSON key
3. Get an Issuer ID at [pay.google.com/business/console](https://pay.google.com/business/console)
4. Add your service account with the **Developer** role

```env
GOOGLE_WALLET_ISSUER_ID="your-issuer-id"
GOOGLE_WALLET_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

> **Note:** Save URLs only work on Android with the Google Wallet app installed.

---

## Apple Wallet Setup ($99/year)

Apple Wallet passes require an Apple Developer Program membership and signing certificates.

See **`docs/apple-wallet-setup.md`** for detailed instructions, or follow the quick steps:

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. Create a Pass Type ID and signing certificate
3. Export certificate + key as PEM, base64-encode them

```env
APPLE_PASS_TYPE_IDENTIFIER="pass.com.yourcompany.loyalshy"
APPLE_TEAM_IDENTIFIER="YOUR_TEAM_ID"
APPLE_PASS_CERTIFICATE="base64-encoded-cert"
APPLE_PASS_KEY="base64-encoded-key"
APPLE_PASS_KEY_PASSPHRASE="your-passphrase"
APPLE_WWDR_CERTIFICATE="base64-encoded-wwdr"
```

> **Gotcha:** `BETTER_AUTH_URL` must be the apex domain (`https://loyalshy.com`, no `www.`) — it is signed into every `.pkpass` as `webServiceURL`, and iOS strips the Authorization header on cross-host redirects, silently breaking pass updates.

---

## Other Services

| Service | Required | Setup |
|---------|----------|-------|
| **Stripe** | For billing | [dashboard.stripe.com](https://dashboard.stripe.com) — use test mode keys |
| **Resend** | For emails | [resend.com](https://resend.com) — free tier available |
| **Trigger.dev** | For background jobs | [trigger.dev](https://trigger.dev) — free tier available |
| **Cloudflare R2** | For file uploads | S3-compatible object storage |
| **Sentry** | For error tracking | [sentry.io](https://sentry.io) — free tier available |
| **Plausible** | For analytics | [plausible.io](https://plausible.io) — optional, privacy-first |
| **Upstash Redis** | For rate limiting | [upstash.com](https://upstash.com) — auth endpoints fail open to an in-memory fallback if unreachable. Free-tier DBs are auto-deleted after inactivity; prefer pay-as-you-go |

## Staff-App API (`/api/v1`)

There is **no public REST API** (removed in the 2026-04-27 pivot — no API keys, no webhooks). The `/api/v1/**` endpoints exist solely for the loyalshy-staff mobile app and use **session-token bearer auth** (Better Auth session).

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/auth/*` | POST/GET | Sign-in flows (email, Google, QR device pairing, invite), `me`, `select-org` |
| `/contacts`, `/contacts/:id` | GET | Contact search + detail |
| `/passes`, `/passes/:id` | GET | Pass instances (lookup by id or walletPassId) |
| `/passes/:id/actions` | POST | `{action:"stamp"}` or `{action:"redeem"}` only |
| `/rewards/:id/redeem` | POST | Redeem an earned reward |
| `/interactions` | GET | Interaction feed |
| `/templates` | GET | Program list |

## Monitoring

- **`GET /api/health`** — dependency health check: pings the database (Neon) and Upstash Redis with 5s timeouts. Returns 200 when healthy, 503 when degraded. Point an external uptime monitor (UptimeRobot / Better Stack) at `https://loyalshy.com/api/health` on a 5-minute interval.
- **Sentry** — errors are aggregated into issues; configure alert rules (new issue → email, frequency spike) in the Sentry dashboard. Rate-limiter fallback events are tagged `auth-rate-limit` / `contact-form-rate-limit`.

## Admin Panel

Admins access the panel at `/admin` (tiered roles: ADMIN_SUPPORT < ADMIN_BILLING < ADMIN_OPS < SUPER_ADMIN). Set `SUPER_ADMIN_EMAIL` before that user registers — they are auto-promoted on signup:

```env
SUPER_ADMIN_EMAIL="you@example.com"
```

## Partner Program (Agency Channel)

Agency reps sell and set up Loyalshy for clients face-to-face. A user becomes a partner via **/admin/users → "Mark as partner"** (platform-controlled). Partners get:

- **Partner console** (`/dashboard/partner`) — client portfolio with setup checklists and referral link (no earnings view — rev-share terms are negotiated per partner and settled via the admin statement)
- **New client setup** — creates a client org instantly; the rep designs the card, publishes the program, and pairs the staff device as owner
- **Handoff link** (`/claim/{token}`, one-shot, 7-day expiry, optionally emailed) — the business owner signs up and takes ownership; the rep is demoted to **Program manager** (design + distribution + programs, no billing/team/settings)
- **Referral link** (`/register?ref={code}`) — self-signups are attributed automatically (30-day window)
- Partner seats **don't count** against plan staff limits

Attribution lands in `Organization.referredById` and drives two admin pages: **/admin/partners** (monthly rev-share statement: 30% of collected net revenue − 30€ per newly activated client, netted) and **/admin/cohorts** (interaction-based retention, partner vs organic).

Org roles are now three-tier: `owner` > `admin` (Program manager) > `member` (Staff).

## Project Structure

```
/src
  /app              — App Router pages
    /(auth)         — Login / Register / Forgot password / Invite / Claim (ownership handoff)
    /(dashboard)    — Protected dashboard (programs, contacts, settings, admin)
    /(public)       — Landing, pricing, contact, legal, /join/[slug] self-join pages
    /api            — API routes
      /api/v1       — Staff-app API (session-token auth only)
      /api/wallet   — Apple/Google Wallet callbacks + downloads
      /api/health   — Dependency health check (uptime monitoring)
  /components       — Reusable UI (studio, dashboard, marketing, card-renderer)
  /i18n, /messages  — next-intl config + en/es/fr translations
  /lib              — DB client, auth, DAL, wallet generation, rate limiting
  /server           — Server actions
  /trigger          — Trigger.dev job definitions
  /types            — TypeScript types
/e2e                — Playwright E2E tests
/prisma             — Schema & migrations
```

## Scripts

```bash
npm run dev                # Start dev server (Turbopack)
npm run build              # Production build
npm test                   # Run Vitest unit tests
npm run test:e2e           # Run Playwright E2E tests
npx prisma studio          # Open Prisma Studio
npx prisma migrate dev     # Create + apply a migration locally
```

Partner-flow E2E tooling (run against `npm run dev` on port 3000 — Better Auth rejects other origins):

```bash
npx tsx scripts/seed-handoff-e2e.ts          # Seed partner/owner test accounts
npx tsx scripts/e2e-handoff.ts               # Drive the full handoff flow in a headless browser
npx tsx scripts/teardown-e2e-fixtures.ts     # Remove all test fixtures (--dry-run to preview)
```

## Documentation

- `CLAUDE.md` — Architecture rules, conventions, and progress tracking
- `docs/deployment-stack.md` — Production deployment guide
- `docs/file-references.md` — Detailed file-by-file reference
- `docs/apple-wallet-setup.md` — Apple Wallet certificate setup
- `docs/google-oauth-setup.md` — Google OAuth + Wallet API setup
- `docs/email-setup.md` — Email routing setup
