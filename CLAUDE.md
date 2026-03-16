# Loyalshy — Digital Wallet Pass Platform

## Project Overview

Multi-tenant SaaS platform for businesses to create and manage digital wallet passes with Apple/Google Wallet integration. Supports 10 pass types: stamp cards, coupons, memberships, points, prepaid, gift cards, tickets, access passes, transit passes, and business IDs. Contacts receive wallet passes via QR code scan, shareable link, direct issue, bulk CSV import, email, or REST API.

## Stack (Verified Mar 2026)

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
| qrcode | 1.5 | QR code SVG/PNG generation for contact onboarding |
| Vitest | 4.x | Unit + integration tests, v8 coverage |
| Playwright | 1.58 | E2E browser tests (chromium + mobile) |
| Sentry | 10.x (@sentry/nextjs) | Error tracking, source map upload, request instrumentation |
| Plausible | Script-based | Privacy-first analytics (env-gated via NEXT_PUBLIC_PLAUSIBLE_DOMAIN) |
| zustand | ~5.x | State management for card design studio |
| immer | ~10.x | Immutable state updates (zustand middleware) |
| zundo | ~2.x | Undo/redo temporal middleware for zustand |
| next-themes | 0.4.x | Light/dark mode with system preference detection |
| motion | 12.x | Scroll-triggered animations for marketing landing page (FadeIn, Stagger, ScaleIn) |
| next-intl | 4.8.x | i18n — cookie-based locale detection, no URL prefix routing |

## Critical Architecture Rules

### Auth Pattern (NEVER violate)
- **proxy.ts** = UX optimization ONLY (cookie check + redirect). NO DB calls, NO role checks.
- **DAL (`/src/lib/dal.ts`)** = REAL security boundary. Every Server Component and Server Action MUST call DAL functions.
- `getCurrentUser()` — validate session, return user (cached per-request via React `cache()`)
- `assertAuthenticated()` — redirects to /login if no session
- `assertSuperAdmin()` — checks User.role === "super_admin"
- `getOrgMember(organizationId)` — returns member record for current user in org, cached per-request to deduplicate role lookups across layout/page/actions
- `assertOrganizationAccess(organizationId)` — verify org membership via `getOrgMember()` (super admins bypass)
- `assertOrganizationRole(organizationId, "owner")` — verify org role with hierarchy (owner > admin > member)
- `getOrganizationForUser()` — returns lightweight organization record (no includes) via session.activeOrganizationId (cached per-request via React `cache()`)

### Organization as Tenant
- Organization IS the Better Auth Organization — no separate Restaurant entity
- Organization holds billing fields (stripeCustomerId, plan, subscriptionStatus) and branding (logo, brandColor, etc.)
- `session.activeOrganizationId` links the user to their current organization
- After org creation in onboarding, `activeOrganizationId` must be set on the session via `db.session.updateMany()`

### Role System
- `User.role` = **global only**: `USER` (default) or `SUPER_ADMIN`
- Organization-level roles (`OWNER`, `STAFF`) = Better Auth **organization membership** roles
- NEVER put OWNER/STAFF in User.role

### Public REST API
- **Auth**: Bearer token (`lsk_live_` prefix), SHA-256 hashed storage, org-scoped
- **Rate limiting**: Upstash Redis sliding window (per-org per-minute + per-day), in-memory fallback
- **Errors**: RFC 7807 Problem Details format
- **Response envelope**: `{ data, meta: { requestId, pagination? } }`
- **CORS**: `Access-Control-Allow-Origin: *` (safe with Bearer token auth)
- **Idempotency**: Redis-backed for POST/PATCH via `Idempotency-Key` header (24h TTL)
- **Webhooks**: HMAC-SHA256 signed payloads with timestamp replay protection, delivered via Trigger.dev with 5 retries + exponential backoff, auto-disable after 10 consecutive failures
- **Composable handler**: `apiHandler()` wraps auth → rate limit → idempotency → handler → CORS → logging
- **Inline contact + email on POST /passes**: `contactId` OR inline `contact: { fullName, email?, phone? }` (find-or-create), `sendEmail: true` triggers pass-issued email via Trigger.dev/Resend, response always includes `walletUrls` (cardUrl, appleWalletUrl, googleWalletUrl) for embedding in venue confirmation emails
- **Key files**: `api-auth.ts`, `api-handler.ts`, `api-rate-limit.ts`, `api-errors.ts`, `api-response.ts`, `api-cors.ts`, `api-data.ts` (shared data layer + `findOrCreateContact`, `buildWalletUrls`, `sendPassIssuedEmail`), `api-schemas.ts` (Zod), `api-serializers.ts`, `api-events.ts` (webhook dispatch), `api-openapi.ts` (OpenAPI spec + use case guides), `api-keys.ts` (key generation/validation), `api-logger.ts` (fire-and-forget request logging)
- **Server actions**: `api-key-actions.ts` (dashboard key + webhook CRUD)
- **Docs**: `/api/v1/docs` (Scalar interactive reference with use case guides: venue ticketing, loyalty stamps, gym membership, bulk import, webhook sync), `/api/v1/openapi.json` (spec)
- **Plan limits**: Free: 5 req/min, 100/day, 1 key, 1 webhook | Pro (STARTER): 20 req/min, 1k/day, 2 keys, 1 webhook | Business (GROWTH): 60/min, 10k/day, 10 keys, 5 webhooks | Scale: 300/min, 100k/day, 25 keys, 10 webhooks | Enterprise: 600/min, unlimited, 50 keys, 25 webhooks

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

### i18n Rules (next-intl)
- **No URL-based locale routing** — locale is determined by `locale` cookie, then `Accept-Language` header, then default `en`
- **Locales**: `en` (default), `es` (Spanish — first target market is Spain), `fr` (French)
- **Config**: `src/i18n/config.ts` (locale definitions), `src/i18n/request.ts` (server-side detection via `getRequestConfig`)
- **Messages**: `src/messages/en.json` + `src/messages/es.json` + `src/messages/fr.json` — organized by namespace (common, nav, hero, features, pricing, faq, auth, dashboard, errors, etc.)
- **Server components**: use `getTranslations("namespace")` from `next-intl/server` (must be async)
- **Client components**: use `useTranslations("namespace")` from `next-intl`
- **Root layout**: wraps children in `NextIntlClientProvider` with only shared namespaces (`common`, `errors`, `cookieBanner` ~1KB), inside a Suspense boundary (required for `cacheComponents: true`)
- **Route group providers**: Each route group adds a nested `NextIntlClientProvider` with its specific namespaces — nested providers **override** (not merge with) the parent, so each MUST include `common` alongside its route-specific namespaces. `(dashboard)` provides `common`, `dashboard`, `studio`, `serverErrors`; `(auth)` provides `common`, `auth`, `nav`; landing page provides `common` + marketing namespaces. This reduces RSC payload from ~67KB to only what's needed per route.
- **Language switcher**: `src/components/language-switcher.tsx` — sets `locale` cookie and reloads, placed in marketing navbar and dashboard topbar
- **Adding a new locale**: Add to `locales` array in `config.ts`, create `src/messages/{locale}.json`, add `localeNames` entry
- **Server actions**: use `getTranslations("serverErrors")` from `next-intl/server` for error/validation messages
- **Studio panels**: all use `useTranslations("studio.*")` — panels, colors, strip, notifications, details, prize, avatar, template, canvas
- **Coverage**: 100% — 78 files, ~1,300 strings across marketing, auth, dashboard, studio, server actions, and legal pages
- **Namespaces**: common, nav, hero, socialProof, featureShowcase, howItWorks, features, apiSection, passTypesCarousel, walletPreview, testimonials, pricing, faq, tryDemo, closingCta, footer, cookieBanner, auth.login, auth.register, auth.forgotPassword, auth.invite, auth.error, dashboard.nav, dashboard.overview, dashboard.activity, dashboard.topContacts, dashboard.programsSummary, dashboard.contacts, dashboard.addContact, dashboard.contactDetail, dashboard.contactColumns, dashboard.contactTable, dashboard.programs, dashboard.passInstances, dashboard.distribution, dashboard.programSettings, dashboard.programEditor, dashboard.settings, dashboard.settingsForms, dashboard.registerVisit, dashboard.shell, dashboard.rewards, dashboard.jobsHistory, dashboard.onboarding, dashboard.status, dashboard.chart, errors, privacy, terms, cookies, studio.panels, studio.colors, studio.strip, studio.logo, studio.notifications, studio.details, studio.prize, studio.avatar, studio.template, studio.canvas, serverErrors

### Prisma v7 Rules
- Use `prisma.config.ts` for configuration (datasource URL lives here, NOT in schema.prisma)
- Use `@default(dbgenerated("uuidv7()::text"))` for ALL primary key UUIDs (cast to text for String type)
- Mapped enums with `@map` for clean DB values
- `db.ts` uses a lazy Proxy so PrismaClient is not constructed at import time
- **Runtime adapter required**: Prisma v7 datasource URL is build-time only (`prisma.config.ts`). At runtime, `PrismaClient` MUST use `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })` — bare `new PrismaClient()` will fail. This applies to both `src/lib/db.ts` and `src/trigger/db.ts`.

## Folder Structure

```
/src
  /app              → App Router pages
    /(auth)         → Login/Register/Forgot password
    /(dashboard)    → Protected dashboard routes
      /dashboard              → Overview (stat cards, charts, activity feed, top contacts, programs summary)
        /programs             → Programs list (grid cards)
        /programs/[id]        → Program detail (layout + tab nav)
        /programs/[id]/passes     → Per-program passes with type-aware columns
        /programs/[id]/design     → Embedded card design studio (owner)
        /programs/[id]/distribution    → Distribution: QR code, shareable link (owner)
        /programs/[id]/settings   → Status management + delete (owner)
        /contacts             → Contact management
        /rewards              → Cross-program rewards (not in sidebar)
        /settings             → General, Team, Billing, API (owner, all plans)
    /(studio)       → Redirects to /programs/[id]/design (studio now embedded)
    /(public)       → Landing, pricing, QR scan, card view pages
    /api            → API routes
      /api/v1       → Public REST API (Bearer token auth)
        /contacts, /contacts/[id], /contacts/bulk
        /templates, /templates/[id], /templates/[id]/stats
        /passes, /passes/[id], /passes/[id]/actions, /passes/[id]/interactions, /passes/bulk
        /interactions, /interactions/[id]
        /stats, /stats/daily
        /webhooks, /webhooks/[id], /webhooks/[id]/test, /webhooks/[id]/rotate-secret
        /openapi.json → OpenAPI 3.1 spec
        /docs         → Interactive API reference (Scalar)
  /components       → Reusable UI components
    /ui             → Shadcn components
    /card-renderer  → Shared CardRenderer used across all surfaces
    /minigames      → Prize reveal minigames (scratch card, slots, wheel) — shared by dashboard + public card page
    /studio         → Studio editor components (layout, toolbar, floating menu, canvas, panels)
    /dashboard      → Dashboard-specific components
      /overview     → Analytics: stat cards, activity chart, busiest days, recent activity, top contacts, programs summary, skeletons
      /contacts     → Contact table, columns (stacked type icons), filters, detail sheet (passes/visits/rewards tabs, issue pass), empty state
      /programs     → Program list view, tab nav, pass instances, settings
    /marketing      → Landing page components (hero, features, pricing, FAQ, testimonials, social proof, pass types carousel, motion animations)
      motion.tsx     → Reusable scroll-triggered animation components (FadeIn, Stagger, StaggerItem, ScaleIn) — used below-fold only; Hero/SocialProof use CSS animations
      pass-types-carousel.tsx → Auto-playing carousel showcasing all 10 pass types with screenshots, descriptions, and use case tags
    /wallet         → Wallet pass components
  /i18n             → Internationalization config
    config.ts       → Locale definitions (en, es, fr)
    request.ts      → Server-side locale detection (cookie → Accept-Language → default)
  /messages         → Translation JSON files (en.json, es.json, fr.json)
  /lib              → Utilities, db client, auth config, DAL
    /stores         → Zustand stores (card-design-store.ts)
    /wallet         → Wallet pass generation (Apple + Google)
  /server           → Server actions (template-actions, contact-actions, stamp-actions, etc.)
  /trigger          → Trigger.dev job definitions
  /types            → TypeScript type definitions (pass-types.ts, pass-instance.ts, interaction.ts)
  /hooks            → Custom React hooks
  /emails           → React Email templates
  /styles           → Global styles
  /__tests__        → Test setup + mock factories
/e2e                → Playwright E2E tests
```

## Entity Naming (Post-Rewrite)

| Old Name | New Name | Notes |
|----------|----------|-------|
| Restaurant | Organization | Better Auth Organization IS the tenant |
| Customer | Contact | End user receiving passes |
| LoyaltyProgram | PassTemplate | Generic template for any pass type |
| Enrollment | PassInstance | Issued pass (Contact × PassTemplate) |
| Visit | Interaction | Single table with InteractionType discriminator |
| ProgramType | PassType | 10 types (see below) |

### Pass Types (10)
STAMP_CARD, COUPON, MEMBERSHIP, POINTS, PREPAID, GIFT_CARD, TICKET, ACCESS, TRANSIT, BUSINESS_ID

### Join Mode (per PassTemplate)
- **OPEN** (default for STAMP_CARD, COUPON, POINTS, MEMBERSHIP): contacts self-join via QR code or shareable link on `/join/[slug]`
- **INVITE_ONLY** (default for TICKET, ACCESS, TRANSIT, BUSINESS_ID, GIFT_CARD, PREPAID): passes issued by org only (Direct Issue, CSV Import, API). Public join page filters out INVITE_ONLY templates; `joinTemplate` server action rejects them server-side.
- Owners can override the default per program in the Distribution tab.

### Interaction Types
STAMP, COUPON_REDEEM, CHECK_IN, POINTS_EARN, POINTS_REDEEM, PREPAID_USE, PREPAID_RECHARGE, GIFT_CHARGE, GIFT_REFUND, TICKET_SCAN, TICKET_VOID, ACCESS_GRANT, ACCESS_DENY, TRANSIT_BOARD, TRANSIT_EXIT, ID_VERIFY, STATUS_CHANGE, REWARD_EARNED, REWARD_REDEEMED, NOTE

## Development Phases

The full rewrite plan is in `.claude/plans/happy-growing-stroustrup.md`. Phases:

**Original phases (completed):**
- **Phase 0–5** — Foundation, Dashboard, Business Logic, Wallet, Billing, Polish
- **Phase 7–11** — Multi-program, Navigation, Studio, Program Types

**Rewrite phases:**
- **Phase P1** — Schema & Core Data Layer (new Prisma schema, types, DAL)
- **Phase P2** — Server Actions (Loyalty Types: stamp, coupon, membership, points, prepaid)
- **Phase P3** — Server Actions (New Types: gift card, ticket, access, transit, business ID)
- **Phase P4** — Wallet Pass Generators (Apple 3 styles, Google 4 classes)
- **Phase P5** — Dashboard UI (entity renames, navigation updates)
- **Phase P6** — Public Pages & Onboarding (marketing copy, join flow)
- **Phase P7** — Studio & Card Renderer (new type panels)
- **Phase P8** — Admin, Jobs & Polish

## Current Progress

- [x] Phase 0–5, 7–11 — All original phases complete
- [x] Phase P1 — Schema & Core Data Layer (new Prisma schema with PassTemplate/PassInstance/Contact/Interaction/Organization, type definitions, DAL rewrite)
- [x] Phase P2 — Server Actions for loyalty types (stamp, coupon, membership, points, prepaid actions)
- [x] Phase P3 — Server Actions for new types (gift card, ticket, access, transit, business ID actions)
- [x] Phase P4 — Wallet Pass Generators (Apple pass: storeCard/eventTicket/boardingPass/generic; Google pass: Loyalty/GiftCard/EventTicket/Transit/Generic classes)
- [x] Phase P5 — Dashboard UI entity renames (Restaurant→Organization, Customer→Contact, Program→Template, Enrollment→PassInstance throughout all dashboard components, settings, register dialog, wallet renderer, Trigger.dev emails)
- [x] Phase P6 — Public Pages & Onboarding (marketing copy restaurant→business, restaurantName→businessName type rename)
- [x] Phase P7 — Studio & Card Renderer (all 10 type panels, field configs, Apple/Google generators, renderer support)
- [x] Phase P8 — Admin, Jobs & Polish (admin /restaurants/→/organizations/, dashboard /customers/→/contacts/, file + component renames, revalidatePath updates)
- [x] Phase API-1 — API Foundation (ApiKey/WebhookEndpoint/WebhookDelivery/ApiRequestLog models, auth, rate limiting, CORS, error handling, idempotency, request logging)
- [x] Phase API-2 — Core CRUD Endpoints (contacts, templates, passes, interactions — list/detail/create/update/delete routes, shared data layer, serializers)
- [x] Phase API-3 — Domain-Specific Operations (16 type-specific actions, bulk contacts/passes, org/daily/template stats)
- [x] Phase API-4 — Webhooks (HMAC-SHA256 signed delivery via Trigger.dev, endpoint CRUD API, test ping, secret rotation, auto-disable, event dispatch on mutations)
- [x] Phase API-5 — API Dashboard UI (API keys section, webhook management section, server actions for CRUD, settings tab with plan gating)
- [x] Phase PRICING — New pricing model (Free tier on landing page, Pro €29, Business €49, Scale €99, no 14-day trial)
- [x] Phase ONBOARDING — Simplified registration (2 steps: signup + org name → dashboard), FREE plan in Prisma enum + plans.ts, no trial/Stripe at signup, programs usage tracking in billing
- [x] Phase SEO — Comprehensive SEO audit fixes (legal pages, structured data, LCP performance, sitemap, robots.txt, WCAG contrast, HSTS preload, fake social proof removal)
- [x] Phase I18N — Internationalization with next-intl (English + Spanish + French, cookie-based locale, 78 files / ~1,224 strings per locale, 100% coverage — marketing, auth, dashboard, studio, server actions, legal pages)
- [x] Phase PERF — Performance optimization (WebP images, CSS hero animations, Suspense restructure, cached DAL, parallel queries, lazy-loaded dashboard dialogs, skeleton fallbacks)
- [x] Phase PERF-2 — Deep performance pass (cached `getOrgMember()` in DAL, removed unused passTemplates include from `getOrganizationForUser()`, parallelized all sequential DB queries across dashboard pages, Vercel region `fra1` to match Neon DB, i18n message splitting by route group, DB indexes on Reward/Interaction/Contact, contacts page Suspense boundary)
- [x] Phase BUGFIX — Codebase audit fixes: 44 bugs + 5 deferred items across security (auth bypass, SSRF, HTML injection, missing access checks), race conditions (double-stamp, duplicate contact, memberNumber locking via FOR UPDATE), data integrity (wrong field reads, SQL case mismatch, invalid defaults), API consistency (rate limit off-by-one, memory leak, missing requestId, webhook org filter, interactions route through domain actions, contact limit check), UI (broken strip paths, missing Suspense, zundo equality, mid-file import), i18n (hardcoded strings in 8 components), dead code cleanup, R2 storage leak, PassType union typing, sanitized Apple log endpoint, config z.any() replaced with type-specific Zod validation
- [x] Phase REDESIGN — Landing page redesign: asymmetric hero with WalletStack (pass-type images), social proof trust badges (no fake stats), gradient mesh backgrounds on all sections, features bento grid with uniform card layout and equal heights, pass types carousel (flat screenshots, smooth crossfade), feature showcase (smooth crossfade), how-it-works connecting line + perspective screenshots, wallet preview with PhoneMockupInteractive (pass-type images), pricing with stronger highlight + pill buttons, closing CTA with oversized heading, dark mode marketing CSS variables, testimonials removed (fake data), footer CSS variable background, Try Demo section (env-gated via NEXT_PUBLIC_DEMO_JOIN_URL, wallet buttons + join page link), admin showcase system removed (unused, -2080 lines), raw SQL enum fix in reward-actions.ts
- [ ] Phase 6.1 — Production deployment

## Conversation Strategy

**Each sub-prompt (e.g., P1, P2) should be a SEPARATE conversation** to avoid context overflow.

### Starting Each Conversation

Paste this at the start of each new conversation:
```
Read CLAUDE.md, then read the plan in .claude/plans/happy-growing-stroustrup.md.
Continue development from where we left off. Check current progress
in CLAUDE.md and build Phase [PX].
```

### After Each Conversation
Update the "Current Progress" section above to track what's done.

## Key Models (Reference)

**Better Auth core (4):**
1. User (+ additionalFields: role)
2. Session (+ activeOrganizationId)
3. Account
4. Verification

**Better Auth org plugin (3):**
5. Organization (IS the tenant — holds billing, branding, settings)
6. Member (userId + organizationId + role)
7. Invitation (Better Auth's org invite — separate from StaffInvitation)

**Application (14):**
8. PassTemplate (passType: 10 types, joinMode: OPEN/INVITE_ONLY, status: DRAFT/ACTIVE/ARCHIVED, config JSON, startsAt, endsAt)
9. PassInstance (pivot: Contact × PassTemplate — wallet pass, status, data JSON for type-specific state)
10. Contact (end user — identity + denormalized totalInteractions + sequential memberNumber per org)
11. Interaction (type discriminator, metadata JSON, linked to PassInstance)
12. Reward (linked to PassInstance; `revealedAt` nullable — null means prize minigame not yet played)
13. PassDesign (per PassTemplate; typed columns for wallet passes + `editorConfig` JSON for rich studio editor; `cardType`: STAMP/POINTS/TIER/COUPON/PREPAID/GIFT_CARD/TICKET/ACCESS/TRANSIT/BUSINESS_ID/GENERIC; per-program logos: `logoUrl`/`logoAppleUrl`/`logoGoogleUrl` with fallback to Organization logos)
14. WalletPassLog (linked to PassInstance)
15. StaffInvitation (custom invite flow with tokens — NOT Better Auth's Invitation)
16. DeviceRegistration (Apple Wallet push, linked to PassInstance)
17. AnalyticsSnapshot (pre-computed daily metrics)
18. ApiKey (org-scoped, SHA-256 hashed key, prefix for display, scopes, expiry, revocation)
19. WebhookEndpoint (org-scoped, HMAC secret, event subscriptions, auto-disable on failures)
20. WebhookDelivery (delivery log per endpoint, status code, response body, attempts)
21. ApiRequestLog (batched request logging — method, path, status, latency, API key)

## Quality Checklist (Verify After Each Phase)

- [ ] No `any` types, strict TypeScript
- [ ] Every form validates client AND server (Zod)
- [ ] Every server action calls DAL auth first (exceptions: `onboarding-actions.ts` is public-facing, `onboarding-registration-actions.ts` uses assertAuthenticated() not org-level DAL since user has no org yet)
- [ ] Every Server Component calls `getCurrentUser()` from DAL (exception: `/join/[slug]` and `/join/[slug]/card/[passInstanceId]` are public, card page uses HMAC signature verification instead)
- [ ] proxy.ts only reads cookies — no DB calls
- [x] Mobile responsive (test at 375px)
- [x] Loading and error states for all async operations
- [x] No console errors (PII audit complete — all console.error calls sanitized)
- [x] Error boundaries on all route segments
- [x] Icon-only buttons have aria-labels
- [x] Form inputs have aria-invalid + aria-describedby for errors

## Key Auth Files

- `src/lib/auth.ts` — Better Auth server config (Prisma adapter, plugins, email sending, trustedOrigins)
- `src/lib/auth-client.ts` — Client-side auth (createAuthClient + org/admin plugins, baseURL uses window.location.origin in browser)
- `src/app/api/auth/[...all]/route.ts` — API route handler (toNextJsHandler)
- `src/lib/dal.ts` — Data Access Layer (REAL security boundary)
- `proxy.ts` — Optimistic cookie redirect (UX only)
- `src/server/auth-actions.ts` — Staff invitation server actions (email via Trigger.dev, email-verified acceptance, rate-limited token validation)
- `src/lib/api-auth.ts` — API key authentication (Bearer token → ApiContext with orgId, plan check)
- `src/lib/api-keys.ts` — API key generation (`lsk_live_` prefix) and SHA-256 validation

## Pricing & Plans

| Display Name | PlanId (DB) | Monthly | Annual | Contacts | Staff | Programs |
|---|---|---|---|---|---|---|
| Free | FREE | €0 | €0 | 50 | 1 | 1 (stamp card or coupon) |
| Pro | STARTER | €29 | €24 | 500 | 2 | 2 |
| Business | GROWTH | €49 | €39 | 2,500 | 5 | 5 |
| Scale | SCALE | €99 | €79 | Unlimited | 25 | Unlimited |
| Enterprise | ENTERPRISE | Custom | Custom | Unlimited | Unlimited | Unlimited |

**Important:** PlanId values (`FREE`, `STARTER`, `GROWTH`, `SCALE`, `ENTERPRISE`) are used in Prisma enum, Stripe lookup keys, API rate limiting, and throughout the codebase. Display names ("Free", "Pro", "Business") are set in `PLANS` object in `src/lib/plans.ts`. Stripe lookup keys remain `starter_monthly`, `growth_monthly`, etc. Free users have no Stripe customer — Stripe customer is created on-demand at first paid checkout. Subscription cancellation downgrades to FREE. Free plan allows only STAMP_CARD and COUPON pass types (`allowedPassTypes` in plans.ts); paid plans allow all 10. No default program is created at signup — users choose their first program type from the dashboard. All plans include API access — Free plan has tight limits (5 req/min, 100/day, 1 key, 1 webhook) for testing and evaluation.

## Dashboard Navigation

**Sidebar (all users):** Overview, Contacts, Programs
**Sidebar (owner only, after divider):** Settings
**Mobile bottom nav:** Overview | Contacts | [+Register FAB] | Programs | More

### Programs (top-level entity)
- `/dashboard/programs` — list of all programs (grid cards, status badges, pass instance counts)
- `/dashboard/programs/[id]` — program overview with stat cards (layout provides tab nav)
- `/dashboard/programs/[id]/passes` — type-aware pass instances with stat cards, progress columns, status filters, row actions, issue pass sheet, edit contact, send pass email
- `/dashboard/programs/[id]/design` — canvas-first card design studio with floating icon toolbar + floating context panel (owner only)
- `/dashboard/programs/[id]/distribution` — Distribution: join mode toggle, QR/NFC self-service link, direct issue to contacts, bulk CSV import (owner only)
- `/dashboard/programs/[id]/settings` — status management (activate/archive/reactivate) + delete (owner only)

### Settings (account-level only)
- General (organization profile)
- Team (members, invitations)
- Billing (Stripe subscription)
- API (API keys + webhook endpoints — all plans, owner only)
- Jobs (background jobs — super_admin only, hidden from UI, accessible via direct URL)

**Note:** `/dashboard/rewards` still works (command palette, direct URL) but is not in sidebar. `/dashboard/programs/[id]/studio` redirects to `/dashboard/programs/[id]/design`.

### Admin Panel (super_admin only)
- `/admin` — overview stats
- `/admin/users` — user management
- `/admin/organizations` — organization management
## Design Direction

- **Linear/Vercel aesthetic** — NOT generic shadcn defaults. Premium, refined, professional.
- Light/dark mode via `next-themes` (`ThemeProvider` in root layout, `attribute="class"`, `defaultTheme="system"`)
- Theme toggle (sun/moon) in dashboard topbar (`src/components/theme-toggle.tsx`)
- Sidebar: light in light mode, dark in dark mode (uses `--sidebar-*` CSS tokens)
- Dashboard sidebar uses **shadcn Sidebar component** (`SidebarProvider`, `collapsible="icon"`, `SidebarRail`, built-in mobile Sheet) — NOT a custom sidebar
- `mobile-sidebar.tsx` is deprecated (shadcn Sidebar handles mobile automatically)
- 13px body text, tight spacing, Geist font family
- `--brand` CSS variable for per-organization theming (default: `oklch(0.55 0.2 265)`)
- OKLCH color space throughout — all tokens in `globals.css` `:root` / `.dark`
- `TooltipProvider` wraps via `SidebarProvider` (NOT root layout)
- **Studio editor** — Figma/Canva-inspired canvas-first layout: floating vertical icon toolbar with hover tooltips (left edge), floating rounded context panel (slides in from left), full-width canvas with card preview. Sidebar panels are only used on mobile. Desktop uses `FloatingToolMenu` + `ContextPanel` from `context-notch.tsx`. Clicking card elements (strip, fields, logo, etc.) opens the same tool panel as the toolbar — no duplicate zone-specific controls. Dedicated "Fields & Labels" panel combines text/label color controls with field management (add/remove/reorder/rename). Full-rounded (pill) styling on all interactive controls.

## Deployment Infrastructure

| Layer | Service | Notes |
|-------|---------|-------|
| Compute | Vercel (Pro) | Next.js 16 native, preview deploys, `fra1` region (Frankfurt) via `vercel.json` |
| Database | Neon PostgreSQL | Serverless, connection pooling, DB branching, `eu-central-1` (Frankfurt) |
| Cache / Rate Limiting | Upstash Redis | HTTP-based, serverless-safe, @upstash/ratelimit |
| File Storage | Cloudflare R2 | Already configured (S3-compatible) |
| Background Jobs | Trigger.dev | Already configured (9 tasks, 5 queues) |
| Email | Resend | Already configured (via Trigger.dev) |
| Payments | Stripe | Already configured (subscriptions, webhooks) |
| Error Tracking | Sentry | Already configured (source maps) |
| Analytics | Plausible | Already configured (privacy-first) |
| API Docs | Scalar | Interactive API reference at `/api/v1/docs` |
| DNS / CDN | Cloudflare | Free tier, pairs with R2 |

For full deployment guide, checklist, and cost estimate, see **`docs/deployment-stack.md`**.

## Environment Variables

See `.env.example` for full list. Key vars: DATABASE_URL, DATABASE_URL_UNPOOLED, BETTER_AUTH_SECRET, BETTER_AUTH_URL, SUPER_ADMIN_EMAIL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, TRIGGER_SECRET_KEY, RESEND_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL, APPLE_PASS_* (5 vars), GOOGLE_WALLET_* (2 vars), UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_PLAUSIBLE_DOMAIN.

## Detailed File References

For file-by-file reference of each feature area (dashboard, contacts, interactions, rewards, settings, billing, wallet, onboarding, errors, mobile, security, testing, performance), see **`docs/file-references.md`**.



## Surface-Specific Design Directions

### Dashboard — Linear/Vercel Aesthetic
Premium dev-tool energy. Calm, data-dense, trustworthy.

**Typography**
- Geist font, 13px body (established)
- Tight tracking on headings (-0.03em)
- Muted labels, high-contrast values — data always wins

**Color**
- 2-3 surface levels in dark mode (not flat black)
- `--brand` as accent only — never as background
- Status colors: semantic only (green=active, amber=warning, red=error)
- Borders: 1px, subtle — define space without weight

**Components**
- shadcn as base, always reskinned toward Linear density
- Tables: compact rows, hover highlight, no heavy borders
- Stat cards: number-first, label secondary, trend indicator
- Sidebar: already established — don't touch the token system

**Motion**
- Functional only: skeleton → content fade, sheet slide-in
- NO decorative animations inside dashboard
- Transitions: 150ms ease-out max

**Feel**
- Every pixel earns its place
- Information density over whitespace
- A developer would feel at home here

---

### Landing Page — Figma/Design-Tool Aesthetic
Creative-tool energy. Expressive, layered, craft-forward.
Think: Figma.com, Framer.com, Linear's marketing site (not app).

**Typography**
- Geist for body/UI elements (consistency with brand)
- Display headings: oversized, variable weight, fluid sizing
  clamp(2.5rem, 6vw, 5rem) — scale with viewport
- Tracking: very tight on large display (-0.04em to -0.06em)
- Mix weights dramatically: 800 headline → 400 body in same section

**Color**
- Light mode primary — bright, airy, confident
- Dark sections as punctuation (not entire page)
- `--brand` oklch(0.55 0.2 265) as hero accent
- Gradient meshes, not flat fills — subtle oklch-based gradients
- Glass morphism on feature cards: backdrop-blur + translucent bg

**Layout**
- BREAK THE GRID intentionally in hero — overlapping elements, off-axis
- Bento grid for features (not equal card rows)
- Wallet pass previews: static WebP images from /public/pass-types/ in WalletStack and PhoneMockup
- Generous section padding (clamp-based vertical rhythm)
- Full-bleed sections with contained content

**Motion (motion 12.x)**
- Hero: CSS animations (established pattern — keep it)
- Use existing FadeIn/Stagger/ScaleIn from motion.tsx below fold
- Pass previews: subtle float animation (translateY 0→-8px, 3s ease-in-out infinite)
- Feature section: staggered reveal as cards enter viewport
- Pricing: scale-in on recommended plan
- NO scroll-jacking, NO heavy JS animations in hero

**Components**
- Buttons: pill shape (rounded-full) — different from dashboard's sharp buttons
- Feature cards: glass morphism + subtle inner border (1px rgba white)
- Pricing recommended plan: elevated with shadow + brand glow, not just a border
- Pass type carousel: already exists — enhance don't replace

**The Figma Feel Specifics**
- Sections feel like crafted frames, not stacked divs
- Use layering: elements overlap section boundaries
- Wallet passes feel like real objects (perspective transform, multi-layer shadow)
- Color pops feel intentional, not random
- A designer would screenshot this for inspiration

---

### Shared Rules (Both Surfaces)
- OKLCH color space — extend globals.css tokens, never replace
- i18n 100% coverage — every string in /messages/{en,es,fr}.json
- Geist as the connective tissue between both aesthetics
- `--brand` variable is sacred — same value everywhere
- Mobile responsive — test at 375px

### Agent Workflow for Landing Page Work
Before touching any file:
1. Read /src/components/marketing/ — understand what exists
2. Read globals.css — know the token system
3. Identify which section you're redesigning
4. Describe: what Figma-ism you're bringing to this section
5. List new translation keys before writing JSX
6. Use static WebP images from /public/pass-types/ for pass previews

### Agent Workflow for Dashboard Work  
Before touching any file:
1. Read the specific dashboard component(s) affected
2. Check if shadcn component exists — extend it, don't rebuild
3. No new motion unless it's functional (loading → loaded)
4. Verify DAL auth call exists in any new Server Component
