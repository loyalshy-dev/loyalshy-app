# Fidelio — Digital Loyalty Card SaaS

## Project Overview

Multi-tenant SaaS for restaurants to create digital loyalty cards with Apple/Google Wallet passes. Restaurant staff register customer visits; after N visits, customers earn rewards. Customers get wallet passes via QR code scan.

## Stack (Verified Feb 2026)

| Tech | Version | Notes |
|------|---------|-------|
| Next.js | 16.1 | Turbopack default, `proxy.ts` replaces middleware, Cache Components |
| React | 19.2 | View Transitions, useEffectEvent |
| Prisma ORM | 7.4 | Rust-free TS client, `prisma.config.ts` |
| PostgreSQL | 18 | `uuidv7()` for all PKs |
| Better Auth | 1.4.x | Replaces NextAuth — Prisma adapter, org plugin |
| Stripe | 20.x (node) / 8.x (stripe-js) | API version 2026-01-28.clover |
| Trigger.dev | 4.x (v4 GA) | Warm machine reuse, queues defined in code |
| Tailwind CSS | 4.2 | CSS-native `@theme`, no tailwind.config.js |
| shadcn/ui | 3.8.5 | New York style, unified Radix UI |
| Resend | latest | Transactional email |
| Vercel Blob | latest | File uploads (logos) — Vercel is ephemeral |
| passkit-generator | 3.5 | Apple Wallet .pkpass generation from buffers (no FS template) |
| google-auth-library | 10.6 | Google Wallet JWT signing + OAuth2 for API calls |
| qrcode | 1.5 | QR code SVG/PNG generation for customer onboarding |
| Vitest | 4.x | Unit + integration tests, v8 coverage |
| Playwright | 1.58 | E2E browser tests (chromium + mobile) |
| Sentry | 10.x (@sentry/nextjs) | Error tracking, source map upload, request instrumentation |
| Plausible | Script-based | Privacy-first analytics (env-gated via NEXT_PUBLIC_PLAUSIBLE_DOMAIN) |

## Critical Architecture Rules

### Auth Pattern (NEVER violate)
- **proxy.ts** = UX optimization ONLY (cookie check + redirect). NO DB calls, NO role checks.
- **DAL (`/src/lib/dal.ts`)** = REAL security boundary. Every Server Component and Server Action MUST call DAL functions.
- `getCurrentUser()` — validate session, return user (cached per-request via React `cache()`)
- `assertAuthenticated()` — redirects to /login if no session
- `assertSuperAdmin()` — checks User.role === "super_admin"
- `assertRestaurantAccess(restaurantId)` — verify org membership (super admins bypass)
- `assertRestaurantRole(restaurantId, "owner")` — verify org role with hierarchy (owner > admin > member)
- `getRestaurantForUser()` — returns restaurant + active loyalty program

### Restaurant ↔ Organization Linking
- Each Restaurant maps to a Better Auth Organization **by matching slug**
- When creating a restaurant, always create an Organization with the **same slug**
- DAL uses this convention: restaurant.slug === organization.slug

### Role System
- `User.role` = **global only**: `USER` (default) or `SUPER_ADMIN`
- Restaurant-level roles (`OWNER`, `STAFF`) = Better Auth **organization membership** roles
- NEVER put OWNER/STAFF in User.role

### Next.js 16 Rules
- Use `proxy.ts` NOT `middleware.ts`
- All `params` and `searchParams` are async — must be awaited
- Enable `cacheComponents: true` + `reactCompiler: true` in next.config.ts
- **`cacheComponents: true` is INCOMPATIBLE with route segment configs** — do NOT use `export const runtime`, `export const dynamic`, or `export const revalidate` in any route/page file
- Use `"use cache"` directive for cacheable data
- Turbopack is the default bundler
- **cacheComponents + dynamic data**: Server Components that access uncached data (DB queries, auth checks) MUST be wrapped in `<Suspense>`. Layouts doing async work should wrap content in Suspense. Pages should call `await connection()` from `next/server` to opt out of static prerendering.
- **Lazy singletons for build safety**: Any module-scope client construction (`new Stripe()`, `new Resend()`, `new PrismaClient()`) MUST use lazy initialization (Proxy, getter function, or lazy singleton) to avoid errors during `next build` when env vars are unavailable. See `db.ts`, `stripe.ts`, `auth.ts` for patterns.
- `serverExternalPackages: ["passkit-generator"]` in next.config.ts
- Client components using `useSearchParams()` or `useParams()` must be inside a `<Suspense>` boundary
- `tsconfig.json` excludes `prisma/seed.ts` and `scripts/` to avoid build errors

### Tailwind v4 Rules
- NO `tailwind.config.js` — all config in CSS via `@theme`
- Use `@tailwindcss/postcss` (NOT Vite plugin)
- OKLCH color space

### Prisma v7 Rules
- Use `prisma.config.ts` for configuration (datasource URL lives here, NOT in schema.prisma)
- Use `@default(dbgenerated("uuidv7()::text"))` for ALL primary key UUIDs (cast to text for String type)
- Mapped enums with `@map` for clean DB values
- `db.ts` uses a lazy Proxy so PrismaClient is not constructed at import time

## Folder Structure

```
/src
  /app              → App Router pages
    /(auth)         → Login/Register/Forgot password
    /(dashboard)    → Protected dashboard routes
      /dashboard
        /programs             → Programs list
        /programs/[id]        → Program detail (layout + tab nav)
        /programs/[id]/rewards    → Per-program rewards
        /programs/[id]/design     → Card design editor (owner)
        /programs/[id]/qr-code    → QR code (owner)
        /programs/[id]/settings   → Program edit form (owner)
        /customers            → Customer management
        /rewards              → Cross-program rewards (not in sidebar)
        /settings             → General, Team, Billing, Jobs (owner)
    /(public)       → Landing, pricing, QR scan pages
    /api            → API routes
  /components       → Reusable UI components
    /ui             → Shadcn components
    /dashboard      → Dashboard-specific components
      /programs     → Program list view, tab nav, editor, create form
    /marketing      → Landing page components
    /wallet         → Wallet pass components
  /lib              → Utilities, db client, auth config, DAL
  /server           → Server actions (incl. program-actions.ts)
  /trigger          → Trigger.dev job definitions
  /types            → TypeScript type definitions
  /hooks            → Custom React hooks
  /emails           → React Email templates
  /styles           → Global styles
  /__tests__        → Test setup + mock factories
/e2e                → Playwright E2E tests
```

## Development Phases

The full plan is in `loyalty-card-plan-v4.md`. Phases:

- **Phase 0** — Project Bootstrap & Foundation (0.1 Init, 0.2 DB Schema, 0.3 Auth)
- **Phase 1** — Dashboard Layout & Core UX (1.1 Shell, 1.2 Overview, 1.3 Customers)
- **Phase 2** — Core Business Logic (2.1 Visits, 2.2 Rewards, 2.3 Settings)
- **Phase 3** — Wallet Pass Integration (3.1 Apple, 3.2 Google, 3.3 QR/Onboarding, 3.4 Trigger.dev)
- **Phase 4** — Stripe Billing & Onboarding (4.1 Stripe, 4.2 Onboarding Flow)
- **Phase 5** — Polish & Production (5.1 Errors, 5.2 Mobile, 5.3 Security, 5.4 Testing, 5.5 Perf)
- **Phase 6** — Deployment (6.1 Production)

## Current Progress

- [x] Phase 0.1 — Project initialized, /src restructure, all deps installed, folder structure created
- [x] Phase 0.2 — Database schema (13 models, prisma.config.ts, db.ts singleton, seed file)
- [x] Phase 0.3 — Auth configuration (Better Auth + org plugin, DAL, proxy.ts, auth pages, invitation flow)
- [x] Phase 1.1 — Dashboard shell (sidebar, topbar, command palette, mobile nav, placeholder pages)
- [x] Phase 1.2 — Overview dashboard (stat cards, visits chart, busiest days, reward distribution, activity feed, top customers)
- [x] Phase 1.3 — Customer management (table, search, filters, add/edit/delete, detail sheet, progress ring)
- [x] Phase 2.1 — Visit registration flow (search dialog, stamp card, confirm animation, reward celebration)
- [x] Phase 2.2 — Reward management (table, tabs, search, date filters, redeem flow, stat cards, auto-expiry placeholder)
- [x] Phase 2.3 — Settings & restaurant configuration (general profile, team management, billing placeholder)
- [x] Phase 3.1 — Apple Wallet pass generation (passkit-generator, pass builder, server action, 5 callback routes, push placeholder)
- [x] Phase 3.2 — Google Wallet pass generation (google-auth-library, JWT save URLs, Generic Pass class/object, PATCH updates, server action, 2 API routes)
- [x] Phase 3.3 — QR Code & Onboarding Flow (QR generation, /join/[slug] public page, device detection, wallet pass download, already-a-member detection, QR settings page)
- [x] Phase 3.4 — Trigger.dev background jobs (trigger.config.ts, 5 queues, 8 tasks, APNs push, email via Trigger.dev, jobs page)
- [x] Phase 4.1 — Stripe subscription billing (plans, checkout, webhook, portal, billing settings, plan enforcement, banners)
- [x] Phase 4.2 — Onboarding flow & landing page (multi-step registration wizard, marketing landing page, onboarding checklist, proxy.ts update)
- [x] Phase 5.1 — Error handling, loading states & edge cases (error boundaries, typed errors, subscription gate, accessibility, aria-labels)
- [x] Phase 5.2 — Responsive design & mobile optimization (safe areas, mobile nav FAB, touch targets, reward card view, PWA manifest)
- [x] Phase 5.3 — Security hardening (security headers, env validation, sanitization, rate limiting, auth gaps, soft delete, password strength, webhook idempotency, PII audit)
- [x] Phase 5.4 — Testing (Vitest unit + integration tests, Playwright E2E setup, 93 tests across 9 files)
- [x] Phase 5.5 — Performance & SEO (DB indexes, image optimization, Sentry, Plausible analytics, sitemap, robots.txt, OG image, JSON-LD, debounce fixes, router.prefetch)
- [x] Phase 7 — Multi-program restructure (Enrollment pivot entity, per-program CardDesign, ProgramStatus lifecycle, multi-enrollment wallet passes, 94 tests passing)
- [x] Phase 8 — Dashboard navigation restructure (Programs as top-level sidebar item with per-program sub-pages, Settings simplified to General/Team/Billing/Jobs)
- [ ] Phase 6.1 — Production deployment

## Conversation Strategy

**Each sub-prompt (e.g., 0.2, 1.1) should be a SEPARATE conversation** to avoid context overflow.

### Starting Each Conversation

Paste this at the start of each new conversation:
```
Read CLAUDE.md, then read loyalty-card-plan-v4.md Phase [X.Y] prompt.
Continue development from where we left off. Check current progress
in CLAUDE.md and build Phase [X.Y].
```

### After Each Conversation
Update the "Current Progress" section above to track what's done.

## Key Models (Reference)

**Better Auth core (4):**
1. User (+ additionalFields: role, restaurantId)
2. Session (+ activeOrganizationId)
3. Account
4. Verification

**Better Auth org plugin (3):**
5. Organization (linked to Restaurant by slug)
6. Member (userId + organizationId + role)
7. Invitation (Better Auth's org invite — separate from StaffInvitation)

**Application (11):**
8. Restaurant (tenant)
9. LoyaltyProgram (status: DRAFT/ACTIVE/ARCHIVED, startsAt, endsAt)
10. Enrollment (pivot: Customer × LoyaltyProgram — cycle visits, wallet pass, status)
11. Customer (end user — identity + denormalized totalVisits)
12. Visit (stamp/check-in, linked to Enrollment)
13. Reward (linked to Enrollment)
14. CardDesign (per LoyaltyProgram, not per Restaurant)
15. WalletPassLog (linked to Enrollment)
16. StaffInvitation (custom invite flow with tokens — NOT Better Auth's Invitation)
17. DeviceRegistration (Apple Wallet push, linked to Enrollment)
18. AnalyticsSnapshot (pre-computed daily metrics)

## Quality Checklist (Verify After Each Phase)

- [ ] No `any` types, strict TypeScript
- [ ] Every form validates client AND server (Zod)
- [ ] Every server action calls DAL auth first (exceptions: `onboarding-actions.ts` is public-facing, `onboarding-registration-actions.ts` uses assertAuthenticated() not restaurant-level DAL since user has no restaurant yet)
- [ ] Every Server Component calls `getCurrentUser()` from DAL (exception: `/join/[slug]` is public)
- [ ] proxy.ts only reads cookies — no DB calls
- [x] Mobile responsive (test at 375px)
- [x] Loading and error states for all async operations
- [x] No console errors (PII audit complete — all console.error calls sanitized)
- [x] Error boundaries on all route segments
- [x] Icon-only buttons have aria-labels
- [x] Form inputs have aria-invalid + aria-describedby for errors

## Key Auth Files

- `src/lib/auth.ts` — Better Auth server config (Prisma adapter, plugins, email sending)
- `src/lib/auth-client.ts` — Client-side auth (createAuthClient + org/admin plugins)
- `src/app/api/auth/[...all]/route.ts` — API route handler (toNextJsHandler)
- `src/lib/dal.ts` — Data Access Layer (REAL security boundary)
- `proxy.ts` — Optimistic cookie redirect (UX only)
- `src/server/auth-actions.ts` — Staff invitation server actions (email via Trigger.dev, email-verified acceptance, rate-limited token validation)

## Dashboard Navigation

**Sidebar (all users):** Overview, Customers, Programs
**Sidebar (owner only, after divider):** Settings
**Mobile bottom nav:** Overview | Customers | [+Visit FAB] | Programs | More

### Programs (top-level entity)
- `/dashboard/programs` — list of all programs (grid cards, status badges, enrollment counts)
- `/dashboard/programs/[id]` — program overview with stat cards (layout provides tab nav)
- `/dashboard/programs/[id]/rewards` — per-program rewards (reuses RewardsView with `hideProgramFilter`)
- `/dashboard/programs/[id]/design` — card design editor (owner only)
- `/dashboard/programs/[id]/qr-code` — QR code for this program (owner only)
- `/dashboard/programs/[id]/settings` — program edit form (owner only)

### Settings (account-level only)
- General (restaurant profile)
- Team (members, invitations)
- Billing (Stripe subscription)
- Jobs (background jobs — separate page)

**Note:** `/dashboard/rewards` still works (command palette, direct URL) but is not in sidebar. `/dashboard/settings/qr-code` redirects to `/dashboard/programs`.

## Design Direction

- **Linear/Vercel aesthetic** — NOT generic shadcn defaults. Premium, refined, professional.
- Dark sidebar (`oklch(0.16)`) with light content area
- 13px body text, tight spacing, Geist font family
- `--brand` CSS variable for per-restaurant theming (default: `oklch(0.55 0.2 265)`)
- OKLCH color space throughout — all tokens in `globals.css` `:root` / `.dark`
- `TooltipProvider` wraps dashboard shell (NOT root layout)

## Environment Variables

See `.env.example` for full list. Key vars: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, TRIGGER_SECRET_KEY, RESEND_API_KEY, BLOB_READ_WRITE_TOKEN, APPLE_PASS_* (5 vars), GOOGLE_WALLET_* (2 vars), NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_PLAUSIBLE_DOMAIN.

## Detailed File References

For file-by-file reference of each feature area (dashboard, customers, visits, rewards, settings, billing, wallet, onboarding, errors, mobile, security, testing, performance), see **`docs/file-references.md`**.
