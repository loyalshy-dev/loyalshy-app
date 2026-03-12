# Loyalshy — Digital Wallet Pass Platform

Multi-tenant SaaS platform for businesses to create and manage digital wallet passes with Apple and Google Wallet integration. Supports 10 pass types: stamp cards, coupons, memberships, points programs, prepaid passes, gift cards, event tickets, access passes, transit passes, and business IDs.

## Tech Stack

Next.js 16 | React 19 | Prisma 7 | PostgreSQL 18 | Better Auth | Stripe | Trigger.dev | Tailwind CSS 4 | shadcn/ui

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 18 (or Docker)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up the database

```bash
# Start PostgreSQL (Docker example)
docker run -d --name loyalshy-db \
  -e POSTGRES_USER=loyalshy \
  -e POSTGRES_PASSWORD=loyalshy \
  -e POSTGRES_DB=loyalshy \
  -p 5433:5432 \
  postgres:18

# Push the schema
pnpm prisma db push

# Seed the database (optional)
pnpm prisma db seed
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values. See sections below for service-specific setup.

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Organization** | Tenant — a business using the platform |
| **PassTemplate** | Blueprint for a type of pass (e.g., "Coffee Stamp Card", "VIP Membership") |
| **PassInstance** | An issued pass — links a Contact to a PassTemplate |
| **Contact** | End user who receives passes |
| **Interaction** | Any event on a pass (stamp, check-in, points earn, ticket scan, etc.) |

## Pass Types

| Type | Description |
|------|-------------|
| STAMP_CARD | Collect stamps, earn rewards |
| COUPON | Single or multi-use discount codes |
| MEMBERSHIP | Digital ID with tier, benefits, lifecycle |
| POINTS | Earn and redeem points from a catalog |
| PREPAID | Fixed-use passes with optional recharge |
| GIFT_CARD | Monetary balance with partial redemption |
| TICKET | Event entry with scan tracking |
| ACCESS | Facility/area access with time restrictions |
| TRANSIT | Boarding passes with origin/destination |
| BUSINESS_ID | Employee/member identification |

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
| **Upstash Redis** | For API rate limiting | [upstash.com](https://upstash.com) — optional, has in-memory fallback |

## Public REST API

Full REST API for programmatic access to contacts, passes, interactions, and webhooks.

- **Base URL**: `/api/v1`
- **Auth**: Bearer token (`Authorization: Bearer lsk_live_...`)
- **Docs**: Interactive API reference at `/api/v1/docs` (powered by Scalar)
- **OpenAPI spec**: `/api/v1/openapi.json`

API keys are managed in **Settings > API** in the dashboard. All plans include API access.

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/contacts` | GET, POST | List and create contacts |
| `/contacts/:id` | GET, PATCH, DELETE | Contact detail, update, soft-delete |
| `/contacts/bulk` | POST | Bulk import (up to 200) |
| `/templates` | GET | List pass templates |
| `/templates/:id` | GET | Template detail |
| `/templates/:id/stats` | GET | Template statistics |
| `/passes` | GET, POST | List and issue passes |
| `/passes/:id` | GET | Pass instance detail |
| `/passes/:id/actions` | POST | Type-specific actions (stamp, redeem, check_in, etc.) |
| `/passes/:id/interactions` | GET, POST | Pass interactions |
| `/passes/bulk` | POST | Bulk issue (up to 100) |
| `/interactions` | GET | Cross-pass interaction list |
| `/interactions/:id` | GET | Interaction detail |
| `/stats` | GET | Organization aggregate stats |
| `/stats/daily` | GET | Daily time series (max 90 days) |
| `/webhooks` | GET, POST | Webhook endpoint management |
| `/webhooks/:id` | GET, PATCH, DELETE | Endpoint detail, update, delete |
| `/webhooks/:id/test` | POST | Send test ping |
| `/webhooks/:id/rotate-secret` | POST | Rotate signing secret |

## Admin Panel

Super admins can access the admin panel at `/admin`. Set `SUPER_ADMIN_EMAIL` before the user registers — they will be auto-promoted on signup:

```env
SUPER_ADMIN_EMAIL="you@example.com"
```

## Project Structure

```
/src
  /app              — App Router pages
    /(auth)         — Login / Register / Forgot password
    /(dashboard)    — Protected dashboard routes
    /(admin)        — Super admin panel
    /(admin-studio) — Showcase card studio (own layout)
    /(studio)       — Card design studio (own layout)
    /(public)       — Landing, pricing, QR scan pages
    /api            — API routes (auth, wallet callbacks, webhooks)
      /api/v1       — Public REST API (19 endpoints)
      /api/v1/docs  — Interactive API reference (Scalar)
  /components       — Reusable UI components
  /lib              — Utilities, DB client, auth, DAL, wallet generation
  /server           — Server actions (per pass type + shared)
  /trigger          — Trigger.dev job definitions
  /types            — TypeScript types (pass-types, pass-instance, interaction)
/e2e                — Playwright E2E tests
/prisma             — Schema & seed
```

## Scripts

```bash
pnpm dev              # Start dev server (Turbopack)
pnpm build            # Production build
pnpm test             # Run Vitest unit tests
pnpm test:e2e         # Run Playwright E2E tests
pnpm prisma studio    # Open Prisma Studio
pnpm prisma db push   # Push schema changes
```

## Documentation

- `CLAUDE.md` — Architecture rules, conventions, and progress tracking
- `docs/deployment-stack.md` — Production deployment guide
- `docs/file-references.md` — Detailed file-by-file reference
- `docs/apple-wallet-setup.md` — Apple Wallet certificate setup
- `docs/google-oauth-setup.md` — Google OAuth + Wallet API setup
- `/api/v1/docs` — Interactive API reference (live)
- `/api/v1/openapi.json` — OpenAPI 3.1 specification
