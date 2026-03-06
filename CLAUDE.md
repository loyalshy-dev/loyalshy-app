# Loyalshy — Digital Loyalty Card SaaS

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
| Cloudflare R2 | @aws-sdk/client-s3 | File uploads (logos, strip images, stamp icons) via S3-compatible API |
| passkit-generator | 3.5 | Apple Wallet .pkpass generation from buffers (no FS template) |
| google-auth-library | 10.6 | Google Wallet JWT signing + OAuth2 for API calls |
| qrcode | 1.5 | QR code SVG/PNG generation for customer onboarding |
| Vitest | 4.x | Unit + integration tests, v8 coverage |
| Playwright | 1.58 | E2E browser tests (chromium + mobile) |
| Sentry | 10.x (@sentry/nextjs) | Error tracking, source map upload, request instrumentation |
| Plausible | Script-based | Privacy-first analytics (env-gated via NEXT_PUBLIC_PLAUSIBLE_DOMAIN) |
| zustand | ~5.x | State management for card design studio |
| immer | ~10.x | Immutable state updates (zustand middleware) |
| zundo | ~2.x | Undo/redo temporal middleware for zustand |
| next-themes | 0.4.x | Light/dark mode with system preference detection |

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
    /(studio)       → Full-page card design studio (own layout, no dashboard shell)
      /dashboard/programs/[id]/studio → Canva-like editor
    /(admin-studio) → Full-page showcase card studio (own layout, super_admin only)
      /admin/showcase/[id]/studio → Showcase card editor
    /(public)       → Landing, pricing, QR scan, card view pages
    /api            → API routes
  /components       → Reusable UI components
    /ui             → Shadcn components
    /card-renderer  → Shared CardRenderer used across all surfaces
    /minigames      → Prize reveal minigames (scratch card, slots, wheel) — shared by dashboard + public card page
    /studio         → Studio editor components (layout, toolbar, canvas, panels)
    /dashboard      → Dashboard-specific components
      /programs     → Program list view, tab nav, editor, create form
    /admin/showcase → Showcase card management + studio adapter
    /marketing      → Landing page components
    /wallet         → Wallet pass components
  /lib              → Utilities, db client, auth config, DAL
    /stores         → Zustand stores (card-design-store.ts)
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
- **Phase 9** — Card Design Studio (9A Schema+Store, 9B CardRenderer, 9C Studio Layout, 9D Templates, 9E Panels, 9F Propagation+Polish)
- **Phase 10F** — PREPAID Program Type + Enhanced MEMBERSHIP (10F PREPAID + Membership Lifecycle)
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
- [x] Phase 9A — Schema + Store + Server Action (CardType enum, editorConfig JSON column, zustand+immer+zundo store, updated saveCardDesign)
- [x] Phase 9B — Shared CardRenderer (stamp-grid, points-display, tier-display, coupon-display, code-renderer, cutout-overlay, pattern-overlay, buildEditorConfig)
- [x] Phase 9C — Full-page Studio Layout (3-panel Canva-like editor, toolbar, canvas, tool selector, panel shell, mobile responsive, keyboard shortcuts)
- [x] Phase 9D — Template Gallery (30+ templates across 4 card types, template-panel with filters)
- [x] Phase 9E — Property Panels (14 panels: colors, background, stamp, points, tier, coupon, typography, layout, cutout, code, fields, logo, strip, templates)
- [x] Phase 9F — Design Propagation + Polish (CardRenderer in visit registration, customer detail, onboarding, QR poster; /design as preview page with "Open Studio" button; mobile studio layout; error/loading boundaries)
- [x] Phase 10A — Program Types Foundation (ProgramType enum on LoyaltyProgram, config JSON column, 2-step create form, type-aware list/detail/settings/tabs, stamp-only visit guard, 131 tests passing)
- [x] Phase 10B — Coupon Redemption Flow (redeemCoupon server action, auto-create Reward on coupon enrollment, coupon redemption in register-visit dialog, single/unlimited coupon support, 137 tests passing)
- [x] Phase 10C — Membership Check-in Flow (checkInMember server action, CHECK_IN wallet pass update, register-visit dialog includes MEMBERSHIP, Crown icon, 144 tests passing)
- [x] Phase 10D — Type-specific Wallet Passes (Apple/Google pass generators type-aware via cardType→getFieldLayout, COUPON fields: discount/validUntil/couponCode, MEMBERSHIP fields: tier/benefits/memberSince, stamp grid guarded to STAMP/POINTS only, programType+config wired through all callers, Google PATCH type-dispatch for all 4 types, coupon prize assigned at enrollment for immediate minigame play, reveal link in initial JWT + PATCH, redeemed state on coupon pass, endsAt/status validation on all actions)
- [x] Phase 10E — POINTS Program Type (ProgramType.POINTS, pointsBalance on Enrollment, description+pointsCost on Reward, PointsConfig/catalog, earnPoints+redeemPoints actions, wallet pass POINTS dispatch, create form+editor+register-visit dialog+programs list, 177 tests passing)
- [x] Phase 11 — Admin Showcase Cards (ShowcaseCard model, admin CRUD at /admin/showcase, full-page studio editor reusing existing panels, marketing landing page fetches from DB with hardcoded fallback, max 5 cards, 144 tests passing)
- [x] Phase 10F — PREPAID Program Type + Enhanced MEMBERSHIP (ProgramType.PREPAID with remainingUses countdown, rechargeable passes, usePrepaid+rechargePrepaid actions; MEMBERSHIP redesigned as Digital ID with suspend/activate/cancel lifecycle, expiresAt/suspendedAt on Enrollment; Apple+Google wallet passes type-aware for PREPAID; all wallet pass callers wired with remainingUses; CardType PREPAID in studio+renderer; create form+editor+programs list+detail page+register-visit dialog; 178 tests passing)
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

**Application (12):**
8. Restaurant (tenant)
9. LoyaltyProgram (programType: STAMP_CARD/COUPON/MEMBERSHIP/POINTS/PREPAID, status: DRAFT/ACTIVE/ARCHIVED, config JSON, startsAt, endsAt)
10. Enrollment (pivot: Customer × LoyaltyProgram — cycle visits, wallet pass, status, remainingUses, pointsBalance, suspendedAt, expiresAt)
11. Customer (end user — identity + denormalized totalVisits)
12. Visit (stamp/check-in, linked to Enrollment)
13. Reward (linked to Enrollment; `revealedAt` nullable — null means prize minigame not yet played by customer)
14. CardDesign (per LoyaltyProgram; typed columns for wallet passes + `editorConfig` JSON for rich studio editor; `cardType`: STAMP/POINTS/TIER/COUPON/PREPAID)
15. WalletPassLog (linked to Enrollment)
16. StaffInvitation (custom invite flow with tokens — NOT Better Auth's Invitation)
17. DeviceRegistration (Apple Wallet push, linked to Enrollment)
18. AnalyticsSnapshot (pre-computed daily metrics)
19. ShowcaseCard (marketing landing page card examples; `designData` JSON + `metadata` JSON + `sortOrder`)

## Quality Checklist (Verify After Each Phase)

- [ ] No `any` types, strict TypeScript
- [ ] Every form validates client AND server (Zod)
- [ ] Every server action calls DAL auth first (exceptions: `onboarding-actions.ts` is public-facing, `onboarding-registration-actions.ts` uses assertAuthenticated() not restaurant-level DAL since user has no restaurant yet)
- [ ] Every Server Component calls `getCurrentUser()` from DAL (exception: `/join/[slug]` and `/join/[slug]/card/[enrollmentId]` are public, card page uses HMAC signature verification instead)
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
- `/dashboard/programs/[id]/design` — card design preview with "Open Studio" button (owner only)
- `/dashboard/programs/[id]/studio` — full-page Canva-like card design editor (own layout, no dashboard shell)
- `/dashboard/programs/[id]/qr-code` — QR code for this program (owner only)
- `/dashboard/programs/[id]/settings` — program edit form (owner only)

### Settings (account-level only)
- General (restaurant profile)
- Team (members, invitations)
- Billing (Stripe subscription)
- Jobs (background jobs — separate page)

**Note:** `/dashboard/rewards` still works (command palette, direct URL) but is not in sidebar. `/dashboard/settings/qr-code` redirects to `/dashboard/programs`.

### Admin Panel (super_admin only)
- `/admin` — overview stats
- `/admin/users` — user management
- `/admin/restaurants` — restaurant management
- `/admin/showcase` — marketing showcase card management (up to 5 cards)
- `/admin/showcase/[id]/studio` — full-page card design editor for showcase cards (own layout, `(admin-studio)` route group)

## Design Direction

- **Linear/Vercel aesthetic** — NOT generic shadcn defaults. Premium, refined, professional.
- Light/dark mode via `next-themes` (`ThemeProvider` in root layout, `attribute="class"`, `defaultTheme="system"`)
- Theme toggle (sun/moon) in dashboard topbar (`src/components/theme-toggle.tsx`)
- Sidebar: light in light mode, dark in dark mode (uses `--sidebar-*` CSS tokens)
- Dashboard sidebar uses **shadcn Sidebar component** (`SidebarProvider`, `collapsible="icon"`, `SidebarRail`, built-in mobile Sheet) — NOT a custom sidebar
- `mobile-sidebar.tsx` is deprecated (shadcn Sidebar handles mobile automatically)
- 13px body text, tight spacing, Geist font family
- `--brand` CSS variable for per-restaurant theming (default: `oklch(0.55 0.2 265)`)
- OKLCH color space throughout — all tokens in `globals.css` `:root` / `.dark`
- `TooltipProvider` wraps via `SidebarProvider` (NOT root layout)

## Deployment Infrastructure

| Layer | Service | Notes |
|-------|---------|-------|
| Compute | Vercel (Pro) | Next.js 16 native, preview deploys |
| Database | Neon PostgreSQL | Serverless, connection pooling, DB branching |
| Cache / Rate Limiting | Upstash Redis | HTTP-based, serverless-safe, @upstash/ratelimit |
| File Storage | Cloudflare R2 | Already configured (S3-compatible) |
| Background Jobs | Trigger.dev | Already configured (8 tasks, 5 queues) |
| Email | Resend | Already configured (via Trigger.dev) |
| Payments | Stripe | Already configured (subscriptions, webhooks) |
| Error Tracking | Sentry | Already configured (source maps) |
| Analytics | Plausible | Already configured (privacy-first) |
| DNS / CDN | Cloudflare | Free tier, pairs with R2 |

For full deployment guide, checklist, and cost estimate, see **`docs/deployment-stack.md`**.

## Environment Variables

See `.env.example` for full list. Key vars: DATABASE_URL, DATABASE_URL_UNPOOLED, BETTER_AUTH_SECRET, BETTER_AUTH_URL, SUPER_ADMIN_EMAIL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, TRIGGER_SECRET_KEY, RESEND_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL, APPLE_PASS_* (5 vars), GOOGLE_WALLET_* (2 vars), UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_PLAUSIBLE_DOMAIN.

## Detailed File References

For file-by-file reference of each feature area (dashboard, customers, visits, rewards, settings, billing, wallet, onboarding, errors, mobile, security, testing, performance), see **`docs/file-references.md`**.
