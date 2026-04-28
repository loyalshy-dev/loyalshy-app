# Loyalshy — Digital Loyalty Platform for Small Businesses

## Project Overview

Multi-tenant SaaS for cafés, salons, and small retail to run digital loyalty programs in Apple/Google Wallet. **Two pass types only**: STAMP_CARD (reward after N visits) and COUPON (one-time or unlimited redeemable offers). Contacts receive wallet passes via QR code scan, shareable link, direct issue, or email.

**Strategic pivot 2026-04-27**: cut from 7 pass types + public REST API to 2 types + staff-app-only API. See `.claude/memory/project_pivot_loyalty_only.md` for the full context.

## Stack (Verified Mar 2026)

| Tech | Version | Notes |
|------|---------|-------|
| Next.js | 16.1 | Turbopack default, `proxy.ts` replaces middleware, Cache Components |
| React | 19.2 | View Transitions, useEffectEvent |
| Prisma ORM | 7.4 | Rust-free TS client, `prisma.config.ts` |
| PostgreSQL | 18 | `uuidv7()` for all PKs |
| Better Auth | 1.4.x | Replaces NextAuth — Prisma adapter, org plugin, emailOTP plugin |
| Stripe | 22.x (node) / 8.x (stripe-js) | API version 2026-03-25.dahlia |
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
| html-to-image | 1.11.x | DOM-to-PNG export for card design download (transparent bg, 3x resolution) |
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
- `User.role` = **global only**: `USER` | `ADMIN_SUPPORT` | `ADMIN_BILLING` | `ADMIN_OPS` | `SUPER_ADMIN`
- **Admin role hierarchy**: `ADMIN_SUPPORT` (read-only + impersonate) < `ADMIN_BILLING` (+ billing controls) < `ADMIN_OPS` (+ bans, bulk ops, GDPR) < `SUPER_ADMIN` (everything)
- Organization-level roles (`OWNER`, `STAFF`) = Better Auth **organization membership** roles
- NEVER put OWNER/STAFF in User.role
- **Admin plan bypass**: All admin-tier roles (`isAdminRole()`) bypass org plan limits in `billing-actions.ts`
- **Admin safety guards**: Cannot ban self, cannot change own role, cannot demote last SUPER_ADMIN, cannot ban/revoke users with equal or higher admin role
- **DAL**: `assertAdminRole(minRole)` checks hierarchy, `assertSuperAdmin()` = `assertAdminRole("SUPER_ADMIN")`, `isAdminRole(role)` returns true for any admin tier

### Admin Audit Logging
- **Model**: `AdminAuditLog` with `AdminAction` enum (15 action types), indexed by adminId, targetType, action, createdAt
- **Utility**: `logAdminAction()` in `src/lib/admin-audit.ts` — fire-and-forget, captures IP + user agent from headers
- **Coverage**: All admin mutations (ban, unban, role change, session revoke, impersonation start) are logged with target email as label
- **Note**: Impersonation END is not logged — during impersonation the session belongs to the impersonated user, so admin auth checks fail. Only the START is logged (the security-critical event).
- **Viewer**: `/admin/audit-log` page with action type, target type, and search filters

### Staff-App API (`/api/v1/**`)
The public REST API was deleted in the pivot. Only the loyalshy-staff mobile app uses these endpoints, and only with **session-token auth** (no API keys, no rate limits, no webhooks, no idempotency, no request logging, no OpenAPI/Scalar docs).
- **Auth**: `Authorization: Bearer {sessionToken}` — token from Better Auth session table. `apiHandler()` is gone; use `sessionHandler()` from `src/lib/api-session.ts`. Wrapper extracts token → loads session → checks active org → invokes handler with `{userId, organizationId, role, requestId}`.
- **Errors**: RFC 7807 Problem Details (`{type, status, title, detail, requestId?}`)
- **Response envelope**: `{ data, meta: { requestId, pagination? } }`. Handlers return either `T` (auto-wrapped) or `{ data: T, pagination: {...} }` for paginated lists.
- **CORS**: `Access-Control-Allow-Origin: *` from `src/lib/api-cors.ts`. Every route exports `OPTIONS` returning `handlePreflight()`.
- **Errors thrown inside handlers**: `throw notFound("...")` / `throw badRequest("...")` / `throw forbidden(...)` / `throw new ApiError(409, "Conflict", "...")` from `api-session.ts`.
- **Live endpoints** (8 routes total):
  - `GET /api/v1/contacts` (search + paginated), `GET /api/v1/contacts/[id]`
  - `GET /api/v1/passes` (filter by contactId/templateId/status, paginated), `GET /api/v1/passes/[id]` (looks up by `id` OR `walletPassId` since wallet QRs encode `walletPassId`)
  - `POST /api/v1/passes/[id]/actions` — only `{action:"stamp"}` (STAMP_CARD pass) and `{action:"redeem"}` (COUPON pass). All other action types from the old API are gone.
  - `POST /api/v1/rewards/[id]/redeem`
  - `GET /api/v1/interactions` (paginated)
  - `GET /api/v1/templates` (filter by status)
- **Auth-only endpoints** (also session-based): `/api/v1/auth/{me,select-org,email-signin,google-mobile,invite,device-pair/create,device-pair/claim}`. These predate the wrapper and use raw fetch + their own bearer-token check.
- **Key files**: `src/lib/api-session.ts` (sessionHandler + ApiError), `src/lib/api-serializers.ts` (toApiContact, toApiPassInstance, toApiPassInstanceDetail, toApiReward, toApiInteraction, toApiTemplate), `src/lib/api-cors.ts`. Action transactions are inlined in the route files (not in shared `api-data.ts` — the old shared layer is gone).

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
- **Studio panels**: all use `useTranslations("studio.*")` — panels, colors, strip, notifications, details, prize, template, canvas (no avatar — holder photos are gone)
- **Public join pages**: `/join/[slug]` and `/join/[slug]/card/[id]` wrap in local `NextIntlClientProvider` with `common` + `join` namespaces (same pattern as landing page)
- **Coverage post-pivot**: en/es/fr each ~1,720 lines (down ~349 lines per locale from pre-pivot). Dead namespaces (`apiSection`, `passTypesCarousel`, `admin.featureFlags`, `studio.avatar`) and per-type subkeys (membership/points/giftCard/ticket/businessCard) are removed.
- **Namespaces**: common, nav, hero, socialProof, featureShowcase, howItWorks, features, walletPreview, testimonials, pricing, faq, tryDemo, staffApp, closingCta, footer, cookieBanner, auth.{login,register,forgotPassword,invite,error}, dashboard.{nav,overview,activity,topContacts,programsSummary,contacts,addContact,contactDetail,contactColumns,contactTable,programs,passInstances,distribution,programSettings,programEditor,settings,settingsForms,registerVisit,shell,rewards,jobsHistory,onboarding,status,chart}, errors, privacy, terms, cookies, studio.{panels,colors,strip,logo,notifications,details,prize,template,canvas}, serverErrors, admin.{nav,overview,users,organizations,auditLog,roles,impersonation,common}, join.{card}, contact

### Prisma v7 Rules
- Use `prisma.config.ts` for configuration (datasource URL lives here, NOT in schema.prisma). Migration CLI prefers `DATABASE_URL_UNPOOLED` (direct Neon host, no `-pooler`) and falls back to `DATABASE_URL` — PgBouncer transaction pooling can't reliably handle DDL/advisory locks. Set `DATABASE_URL_UNPOOLED` on Vercel (Production scope) so the build's `prisma migrate deploy` step uses the direct host.
- Use `@default(dbgenerated("uuidv7()::text"))` for ALL primary key UUIDs (cast to text for String type)
- Mapped enums with `@map` for clean DB values
- `db.ts` uses a lazy Proxy so PrismaClient is not constructed at import time
- **Runtime adapter required**: Prisma v7 datasource URL is build-time only (`prisma.config.ts`). At runtime, `PrismaClient` MUST use `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })` — bare `new PrismaClient()` will fail. This applies to both `src/lib/db.ts` and `src/trigger/db.ts`.
- **Shadow database & uuidv7()**: The `uuidv7()` function is defined in the init migration (`20260427000000_init/migration.sql`). This ensures Prisma's shadow database (used by `prisma migrate dev`) has the function available. Never remove it from the init migration.
- **Migration workflow**: `prisma migrate dev --name describe-change` locally → commit migration files → Vercel runs `prisma migrate deploy` on build. If `migrate dev` fails due to drift from prior `db push`, create the migration SQL manually and use `prisma migrate resolve --applied <name>` to mark it as applied.
- **Pivot reset 2026-04-27**: dev DB was reset via `prisma migrate reset --force` (single init migration `20260427000000_init` reflects the post-pivot schema with PassType enum = `STAMP_CARD | COUPON` only, no `joinMode`, no `PlatformConfig`, no API key/webhook/request log tables). When invoking destructive Prisma commands as an AI agent, set `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` to the user's exact consent message.

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
    /(public)       → Landing, pricing, QR scan, card view, contact pages
    /api            → API routes
      /api/v1       → Staff-app REST API (session token only, no public API key)
        /auth/{me,select-org,email-signin,google-mobile,invite,device-pair/{create,claim}}
        /contacts, /contacts/[id]
        /passes, /passes/[id], /passes/[id]/actions
        /rewards/[id]/redeem
        /interactions
        /templates
      /api/image-proxy → Same-origin proxy for R2 images (CORS bypass for PNG export)
  /components       → Reusable UI components
    /ui             → Shadcn components
    /card-renderer  → Shared CardRenderer used across all surfaces
    /minigames      → Prize reveal minigames (scratch card, slots, wheel) — shared by dashboard + public card page
    /studio         → Studio editor components (layout, toolbar, floating menu, canvas, panels)
    /dashboard      → Dashboard-specific components
      /overview     → Analytics: stat cards, activity chart, busiest days, recent activity, top contacts, programs summary, skeletons
      /contacts     → Contact table, columns (stacked type icons), filters, detail sheet (passes/visits/rewards tabs, issue pass), empty state
      /programs     → Program list view, tab nav, pass instances, settings
    /marketing      → Landing page components (hero, features, pricing, FAQ, social proof, motion animations)
      motion.tsx     → Reusable scroll-triggered animation components (FadeIn, Stagger, StaggerItem, ScaleIn) — used below-fold only; Hero/SocialProof use CSS animations
      contact-form.tsx → Contact form client component (Zod validation, honeypot, inquiry type pre-selection from URL params)
      staff-app.tsx → Staff app promotional section with phone mockup, screenshot carousel, feature cards, store badges
      features-carousel-mobile.tsx → Mobile horizontal scroll carousel for features section (client component extracted from server component)
      (deleted in pivot: api-section.tsx, pass-types-carousel.tsx)
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

## Entity Naming

| Name | Notes |
|------|-------|
| Organization | Better Auth Organization IS the tenant |
| Contact | End user receiving passes |
| PassTemplate | Program blueprint (a single org has multiple templates) |
| PassInstance | Issued pass (Contact × PassTemplate) |
| Interaction | Single table with InteractionType discriminator |

### Pass Types (2)
`STAMP_CARD`, `COUPON`. The other 5 (MEMBERSHIP, POINTS, GIFT_CARD, TICKET, BUSINESS_CARD) were deleted in the 2026-04-27 pivot. There is no `joinMode` — every program is open self-join via `/join/[slug]`.

### Interaction Types (6)
`STAMP`, `COUPON_REDEEM`, `STATUS_CHANGE`, `REWARD_EARNED`, `REWARD_REDEEMED`, `NOTE`

## Development Phases

The full rewrite plan is in `.claude/plans/happy-growing-stroustrup.md`. Phases:

**Original phases (completed):**
- **Phase 0–5** — Foundation, Dashboard, Business Logic, Wallet, Billing, Polish
- **Phase 7–11** — Multi-program, Navigation, Studio, Program Types

**Rewrite phases:**
- **Phase P1** — Schema & Core Data Layer (new Prisma schema, types, DAL)
- **Phase P2** — Server Actions (Loyalty Types: stamp, coupon, membership, points)
- **Phase P3** — Server Actions (New Types: gift card, ticket)
- **Phase P4** — Wallet Pass Generators (Apple 3 styles, Google 4 classes)
- **Phase P5** — Dashboard UI (entity renames, navigation updates)
- **Phase P6** — Public Pages & Onboarding (marketing copy, join flow)
- **Phase P7** — Studio & Card Renderer (new type panels)
- **Phase P8** — Admin, Jobs & Polish

## Current Progress

- [x] Phase 0–5, 7–11 — All original phases complete
- [x] Phase P1 — Schema & Core Data Layer (new Prisma schema with PassTemplate/PassInstance/Contact/Interaction/Organization, type definitions, DAL rewrite)
- [x] Phase P2 — Server Actions for loyalty types (stamp, coupon, membership, points actions)
- [x] Phase P3 — Server Actions for new types (gift card, ticket actions)
- [x] Phase P4 — Wallet Pass Generators (Apple pass: storeCard/eventTicket; Google pass: Loyalty/GiftCard/EventTicket/Generic classes)
- [x] Phase P5 — Dashboard UI entity renames (Restaurant→Organization, Customer→Contact, Program→Template, Enrollment→PassInstance throughout all dashboard components, settings, register dialog, wallet renderer, Trigger.dev emails)
- [x] Phase P6 — Public Pages & Onboarding (marketing copy restaurant→business, restaurantName→businessName type rename)
- [x] Phase P7 — Studio & Card Renderer (all type panels, field configs, Apple/Google generators, renderer support)
- [x] Phase P8 — Admin, Jobs & Polish (admin /restaurants/→/organizations/, dashboard /customers/→/contacts/, file + component renames, revalidatePath updates)
- [x] Phase API-1 — API Foundation (ApiKey/WebhookEndpoint/WebhookDelivery/ApiRequestLog models, auth, rate limiting, CORS, error handling, idempotency, request logging)
- [x] Phase API-2 — Core CRUD Endpoints (contacts, templates, passes, interactions — list/detail/create/update/delete routes, shared data layer, serializers)
- [x] Phase API-3 — Domain-Specific Operations (16 type-specific actions, bulk contacts/passes, org/daily/template stats)
- [x] Phase API-4 — Webhooks (HMAC-SHA256 signed delivery via Trigger.dev, endpoint CRUD API, test ping, secret rotation, auto-disable, event dispatch on mutations)
- [x] Phase API-5 — API Dashboard UI (API keys section, webhook management section, server actions for CRUD, settings tab with plan gating)
- [x] Phase PRICING — New pricing model (Free tier on landing page, Pro €29, Business €49, Scale €99, no 14-day trial)
- [x] Phase ONBOARDING — Simplified registration (3 steps: signup + email OTP verification + org name → dashboard), emailOTP plugin (6-digit, 10min expiry, hashed storage, 3 attempts max), Google OAuth skips verify step, session recovery on page refresh, FREE plan in Prisma enum + plans.ts, no trial/Stripe at signup, programs usage tracking in billing
- [x] Phase SEO — Comprehensive SEO audit fixes (legal pages, structured data, LCP performance, sitemap, robots.txt, WCAG contrast, HSTS preload, fake social proof removal)
- [x] Phase I18N — Internationalization with next-intl (English + Spanish + French, cookie-based locale, 78 files / ~1,224 strings per locale, 100% coverage — marketing, auth, dashboard, studio, server actions, legal pages)
- [x] Phase PERF — Performance optimization (WebP images, CSS hero animations, Suspense restructure, cached DAL, parallel queries, lazy-loaded dashboard dialogs, skeleton fallbacks)
- [x] Phase PERF-2 — Deep performance pass (cached `getOrgMember()` in DAL, removed unused passTemplates include from `getOrganizationForUser()`, parallelized all sequential DB queries across dashboard pages, Vercel region `fra1` to match Neon DB, i18n message splitting by route group, DB indexes on Reward/Interaction/Contact, contacts page Suspense boundary)
- [x] Phase BUGFIX — Codebase audit fixes: 44 bugs + 5 deferred items across security (auth bypass, SSRF, HTML injection, missing access checks), race conditions (double-stamp, duplicate contact, memberNumber locking via FOR UPDATE), data integrity (wrong field reads, SQL case mismatch, invalid defaults), API consistency (rate limit off-by-one, memory leak, missing requestId, webhook org filter, interactions route through domain actions, contact limit check), UI (broken strip paths, missing Suspense, zundo equality, mid-file import), i18n (hardcoded strings in 8 components), dead code cleanup, R2 storage leak, PassType union typing, sanitized Apple log endpoint, config z.any() replaced with type-specific Zod validation
- [x] Phase REDESIGN — Landing page redesign: asymmetric hero with WalletStack (pass-type images), social proof trust badges (no fake stats), gradient mesh backgrounds on all sections, features bento grid with uniform card layout and equal heights, pass types carousel (flat screenshots, smooth crossfade), feature showcase (smooth crossfade), how-it-works connecting line + perspective screenshots, wallet preview with PhoneMockupInteractive (pass-type images), pricing with stronger highlight + pill buttons, closing CTA with oversized heading, dark mode marketing CSS variables, testimonials removed (fake data), footer CSS variable background, Try Demo section (env-gated via NEXT_PUBLIC_DEMO_JOIN_URL, wallet buttons + join page link), admin showcase system removed (unused, -2080 lines), raw SQL enum fix in reward-actions.ts
- [x] Phase ADMIN-1 — Admin panel upgrade Phase 1: tiered admin roles (ADMIN_SUPPORT/BILLING/OPS/SUPER_ADMIN), AdminAuditLog model + audit trail on all admin mutations, assertAdminRole() DAL with hierarchy, server-side impersonation logging, audit log viewer page with filters, admin i18n namespace (~183 keys × 3 locales), safety guards (self-protection, last admin, role hierarchy enforcement), Better Auth admin plugin updated with all roles
- [x] Phase CONTACT — Contact form: `/contact` public page with Zod-validated server action, Resend email (team notification + sender confirmation), Upstash Redis rate limiting (3/hr per IP with in-memory fallback), honeypot spam protection, inquiry type routing (general/sales/partnership/support), URL param pre-selection (`?type=sales` from Enterprise pricing CTA), i18n `contact` namespace (~38 keys × 3 locales), navbar/footer/pricing/closing CTA links updated, email header injection protection
- [x] Phase 6.1 — Production deployment (Vercel, public domain)
- [x] Phase BUSINESS_CARD — 7th pass type: digital business card (BUSINESS_CARD enum, BusinessCardConfig, one-per-org constraint, Apple Generic / Google Loyalty pass, studio panel, create form, vCard .vcf download, website embed snippet, i18n 3 locales)
- [x] Phase STAFF-APP — Mobile staff app auth infrastructure: Better Auth `bearer()` plugin, dual auth in `apiHandler()` (API key via `lsk_live_` prefix OR session token), `DevicePairingToken` model, 6 new REST endpoints (`/api/v1/auth/me`, `/select-org`, `/invite` GET+POST, `/device-pair/create`, `/device-pair/claim`, `/google-mobile`), invitation email deep link (`loyalshystaff://invite/{token}?url=`), "Connect Device" QR dialog in Settings > Team (`connect-device.tsx`)
- [x] **Phase PIVOT-2026-04-27** — Strategic cut from 7 pass types to 2 (STAMP_CARD + COUPON). Deleted: MEMBERSHIP/POINTS/GIFT_CARD/TICKET/BUSINESS_CARD enum values, server actions (gift-card-actions, ticket-actions, points/membership flows), studio Avatar/Membership/Points/GiftCard/Ticket/BusinessCard panels, vcard library + route, joinMode field, public REST API surface (kept only auth + staff-app endpoints), API key/webhook/feature-flag/PlatformConfig models. Webapp: ~175 → 0 tsc errors, 125/125 vitest pass, `next build` clean. i18n trimmed ~349 lines per locale across en/es/fr. Marketing repositioned around "digital loyalty for small businesses". Hero/SEO meta/JSON-LD/pricing tiers/FAQ all rewritten.
- [x] **Phase STAFF-API-RESTORE** — After the pivot accidentally broke the staff-app data flow, restored 8 session-only `/api/v1/**` endpoints (no API key, no rate limit, no idempotency, no webhooks, no logging): `GET /contacts`, `/contacts/[id]`, `/passes`, `/passes/[id]`, `POST /passes/[id]/actions` (stamp + redeem only), `POST /rewards/[id]/redeem`, `GET /interactions`, `GET /templates`. Built around `src/lib/api-session.ts` (`sessionHandler`) + `src/lib/api-serializers.ts`. Staff-app types trimmed to 2 pass types, NumericKeypad deleted, demo data + i18n cleaned. Both apps tsc-clean, lint clean.
- [x] **DB reset 2026-04-27** — `prisma migrate reset --force` against Neon dev DB; single init migration `20260427000000_init` reflects post-pivot schema. Build chain (`prisma generate && prisma migrate deploy && next build`) succeeds end-to-end.
- [x] **Prod migration baseline + drift 2026-04-27** — Vercel deploy was failing with `type "user_role" already exists` (prod Neon DB had pre-pivot schema, init migration not recorded as applied). Fixed by: (1) `prisma migrate resolve --applied 20260427000000_init` to baseline; (2) cleaned 11 dead-type rows on prod (1 membership + 1 business_card template, 8 business_card pass instances, cascading 13 wallet_pass_log + 2 device_registration); (3) created drift migration `20260427000001_post_pivot_drift` (135 lines: enum value cuts for pass_type/interaction_type/pass_instance_status/design_card_type, drop joinMode + pointsCost columns, drop api_key/api_request_log/platform_config/webhook_endpoint/webhook_delivery tables, normalize uuidv7() defaults); (4) `migrate deploy` applied cleanly on prod. **Decision**: kept `prisma migrate deploy` in the Vercel build script (single-dev / single-env stack, no PR previews against prod). Added `DATABASE_URL_UNPOOLED` to `prisma.config.ts` so the migration CLI bypasses Neon's PgBouncer pooler. If preview deploys are ever enabled, either move migrate to a GitHub Action with `concurrency` + protection rules, or set up Neon's Vercel branching integration so each preview migrates its own DB branch.
- [x] **Phase BRAND-2026-04-28** — Public-surface rebrand to "the friendliest way to run a loyalty program" (Coral `#FF6B47` / Cream `#FFF8F1` / Ink `#1F1410`, Cabinet Grotesk display + Inter body). **Scope mechanism**: new `[data-brand="loyalshy"]` selector in `globals.css` overrides both the standard shadcn tokens (`--background`, `--foreground`, `--primary`, `--ring`, …) AND the marketing `--mk-*` tokens to cream/ink/coral; matching `.dark [data-brand="loyalshy"]` for dark mode. Applied at three wrapper points only: `src/app/page.tsx` (landing), `src/app/(auth)/layout.tsx` (login/register/forgot/reset/invite), and a new `src/app/(public)/layout.tsx` (contact/privacy/terms/cookies/join). **Dashboard / studio / admin keep the neutral shadcn palette unchanged.** **Fonts**: Inter loaded via `next/font/google` as `--font-inter`; Cabinet Grotesk loaded via Fontshare CDN `<link>` in `layout.tsx` (Indian Type Foundry — not on Google Fonts). Inside `[data-brand="loyalshy"]`, body inherits Inter and `:is(h1,h2,h3,h4,.font-display)` inherits Cabinet Grotesk. Future improvement: switch Cabinet Grotesk to `next/font/local` after dropping woff2 files into `public/fonts/`. **Hero gradient**: kept `mk-gradient-text` two-stop gradient by mapping `--mk-brand-purple` → coral `oklch(0.704 0.193 32)` and `--mk-brand-green` → deeper coral `oklch(0.62 0.215 28)` so the highlight word still has dimension instead of going flat. **Bulk swap**: replaced ~30 inline `oklch(0.55 0.2 265 ...)` and `oklch(0.55 0.17 155 ...)` references across 9 marketing components and 3 `(public)` pages with coral equivalents (sed across `hero/pricing/closing-cta/staff-app/wallet-preview/how-it-works/contact-form/try-demo/testimonials.tsx`, `(public)/contact/page.tsx`, `(public)/join/[slug]/onboarding-form.tsx`, `(public)/join/[slug]/card/[id]/card-page-client.tsx`). Dashboard `busiest-days-chart.tsx` left untouched (out of scope). **Sentence case**: stripped `uppercase` + tightened `tracking-widest`/`tracking-[0.2em]` on 10 marketing eyebrows (hero, pricing, dashboard-preview, try-demo, footer, staff-app, testimonials, wallet-preview) — i18n strings already sentence-case so no message edits needed. **Closing CTA fix**: swapped subtitle from leftover blue tint `oklch(0.85 0.08 265)` → cream `oklch(1 0 0 / 0.85)` for contrast on the coral gradient. **Untouched in this phase** (deferred): logo SVG (verify `currentColor`), product mockups in `/public/platform/*.webp` (white UI clashes with cream — needs frame treatment or new shots), hero copy rewrite to the new tagline.
- [x] **Phase IDEMPOTENCY-2026-04-27** — Concurrency + retry hardening across the staff API and background jobs. **Row locks** (`SELECT … FOR UPDATE`) on `pass_instance` for stamp + coupon redeem (`src/app/api/v1/passes/[id]/actions/route.ts`) and on `reward` for reward redeem (`src/app/api/v1/rewards/[id]/redeem/route.ts`); unlimited-coupon redeems gain a 60s `redeemedAt` debounce. **Atomic device-pair claim**: replaced check-then-update with `updateMany({ where: { id, claimedAt: null } })` so two concurrent QR claims can't both mint sessions. **Stripe webhook dedupe** now matches `Prisma.PrismaClientKnownRequestError.code === "P2002"` (was string-match) and returns 500 on transient DB errors so Stripe retries. **Email idempotency keys** (Resend `Idempotency-Key` + Trigger.dev `idempotencyKey`) on `send-pass-issued-email` (`pass-issued:{passInstanceId}`), `send-welcome-email` (`welcome:{orgId}`), `send-invitation-email` (`invite:{invitationId}`); the manual "resend invitation"/"resend pass email" flows intentionally omit the key. **`expire-rewards`** rewritten as a single atomic `UPDATE … WHERE status='available'::reward_status AND "expiresAt" < now() RETURNING` so a concurrent redeem can't get clobbered. **WalletPassLog dedupe** via deterministic PK derived from `ctx.run.id` (Trigger.dev) — new `createWalletPassLog()` helper in `src/lib/wallet/apple/update-pass.ts`; `notifyApplePassUpdate(id, dedupeKey?)` and `notifyGooglePassUpdate(id, dedupeKey?)` accept the key. **Pass-issuance race** (`distribution-actions.ts`, both call sites) now catches P2002 and reports `already_exists` instead of letting the unique-constraint hit propagate. **`addContact`** P2002 fallback extracts violated field from `err.meta.target` so the UI gets `duplicateField: "email"|"phone"`. **Google PATCH error log** includes `passInstanceId` + `objectId`. **Apple `updatedAt` landmine** documented in `src/trigger/update-wallet-pass.ts` so future refactors don't accidentally double-touch. **10 new vitest regressions** in `src/app/api/v1/passes/[id]/actions/route.test.ts` (lock ordering, double-stamp rejection, single-use coupon rejection, unlimited debounce window) and `src/app/api/v1/auth/device-pair/claim/route.test.ts` (lost-race 410, winning-path session create, upfront-claimed 410). Mock DB extended with `$queryRaw`/`$executeRaw` on tx and a `devicePairingToken` model. 135/135 vitest pass, tsc clean, lint clean.

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

**Application (post-pivot):**
8. PassTemplate (passType: `STAMP_CARD | COUPON`, status: DRAFT/ACTIVE/ARCHIVED, config JSON, startsAt, endsAt — no `joinMode`, all programs are open self-join)
9. PassInstance (pivot: Contact × PassTemplate — wallet pass, status, data JSON for stamp counters / coupon redemption flag)
10. Contact (end user — identity + denormalized totalInteractions + sequential memberNumber per org)
11. Interaction (type discriminator: STAMP/COUPON_REDEEM/STATUS_CHANGE/REWARD_EARNED/REWARD_REDEEMED/NOTE)
12. Reward (linked to PassInstance; `revealedAt` nullable — null means prize minigame not yet played)
13. PassDesign (per PassTemplate; typed columns for wallet passes + `editorConfig` JSON; `cardType`: `STAMP | COUPON`; per-program logos: `logoUrl`/`logoAppleUrl`/`logoGoogleUrl` with fallback to Organization logos)
14. WalletPassLog (linked to PassInstance)
15. StaffInvitation (custom invite flow with tokens — NOT Better Auth's Invitation)
16. DeviceRegistration (Apple Wallet push, linked to PassInstance)
17. AnalyticsSnapshot (pre-computed daily metrics)
18. DevicePairingToken (staff app QR pairing)
19. AdminAuditLog (immutable trail of admin actions)

**Deleted in pivot:** ApiKey, WebhookEndpoint, WebhookDelivery, ApiRequestLog, PlatformConfig.

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

- `src/lib/auth.ts` — Better Auth server config (Prisma adapter, plugins: org, admin, emailOTP; email sending, trustedOrigins)
- `src/lib/auth-client.ts` — Client-side auth (createAuthClient + org/admin/emailOTP plugins, baseURL uses window.location.origin in browser)
- `src/app/api/auth/[...all]/route.ts` — API route handler (toNextJsHandler)
- `src/lib/dal.ts` — Data Access Layer (REAL security boundary)
- `proxy.ts` — Optimistic cookie redirect (UX only)
- `src/server/auth-actions.ts` — Staff invitation server actions (email via Trigger.dev, email-verified acceptance, rate-limited token validation)
- `src/lib/api-session.ts` — Session-token Bearer auth wrapper for `/api/v1/**` staff-app endpoints (`sessionHandler`, `ApiError`, `notFound`, `badRequest`, `forbidden`)
- `src/lib/api-serializers.ts` — Prisma row → JSON shape converters mirroring `loyalshy-staff/lib/types.ts`

## Pricing & Plans

| Display Name | PlanId (DB) | Monthly | Annual | Contacts | Staff | Programs |
|---|---|---|---|---|---|---|
| Free | FREE | €0 | €0 | 50 | 1 | 1 (stamp card or coupon) |
| Pro | STARTER | €29 | €24 | 500 | 2 | 2 |
| Business | GROWTH | €49 | €39 | 2,500 | 5 | 5 |
| Scale | SCALE | €99 | €79 | Unlimited | 25 | Unlimited |
| Enterprise | ENTERPRISE | Custom | Custom | Unlimited | Unlimited | Unlimited |

**Important:** PlanId values (`FREE`, `STARTER`, `GROWTH`, `SCALE`, `ENTERPRISE`) are used in Prisma enum, Stripe lookup keys, and throughout the codebase. Display names ("Free", "Pro", "Business") are set in `PLANS` object in `src/lib/plans.ts`. Stripe lookup keys remain `starter_monthly`, `growth_monthly`, etc. Free users have no Stripe customer — created on-demand at first paid checkout. Subscription cancellation downgrades to FREE. **Plans no longer gate by pass type** (post-pivot only 2 types exist; both are available on every plan). `checkPassTypeAllowed()` just verifies the type is `STAMP_CARD` or `COUPON`. No default program at signup.

**Program limit semantics**: `programLimit` caps **ACTIVE** templates only — drafts and archives are unlimited. The gate fires at publish time (`activateTemplate`, `reactivateTemplate`), not at creation. New programs are always created as `DRAFT`, so `createPassTemplate` does not check `checkTemplateLimit`. `checkTemplateLimit` itself filters by `status: "ACTIVE"` (in `billing-actions.ts`). Result: a FREE user can hold any number of drafts/archives but only 1 ACTIVE program; to publish a second they must archive the first or upgrade.

## Dashboard Navigation

**Sidebar (all users):** Overview, Contacts, Programs
**Sidebar (owner only, after divider):** Settings
**Mobile bottom nav:** Overview | Contacts | [+Register FAB] | Programs | More

### Programs (top-level entity)
- `/dashboard/programs` — list of all programs (grid cards, status badges, pass instance counts)
- `/dashboard/programs/[id]` — program overview with stat cards (layout provides tab nav)
- `/dashboard/programs/[id]/passes` — type-aware pass instances with stat cards, progress columns, status filters, row actions, issue pass sheet, edit contact, send pass email
- `/dashboard/programs/[id]/design` — canvas-first card design studio with floating icon toolbar + floating context panel (owner only)
- `/dashboard/programs/[id]/distribution` — Distribution: QR/NFC self-service link, direct issue to contacts (owner only). No join-mode toggle — every program is open self-join.
- `/dashboard/programs/[id]/settings` — status management (activate/archive/reactivate) + delete (owner only)

### Settings (account-level only)
- General (organization profile)
- Team (members, invitations)
- Billing (Stripe subscription)
- Jobs (background jobs — super_admin only, hidden from UI, accessible via direct URL)
- (Removed in pivot: API keys + webhooks tab.)

**Note:** `/dashboard/rewards` still works (command palette, direct URL) but is not in sidebar. `/dashboard/programs/[id]/studio` redirects to `/dashboard/programs/[id]/design`.

### Admin Panel (any admin role — layout guards via `assertAdminRole("ADMIN_SUPPORT")`)
- `/admin` — overview stats (platform KPIs, MRR, plan/subscription breakdown)
- `/admin/users` — user management (search, filters: all/banned/admins/super_admins, ban/unban, role change, impersonation, session revoke)
- `/admin/organizations` — organization management (search, subscription status filters, detail sheet with team/stats/Stripe link)
- `/admin/audit-log` — immutable audit trail of all admin actions (action/target type filters, search by target)
- (Removed in pivot: `/admin/feature-flags` — only 2 pass types now, no per-type gating needed.)

## Design Direction

- **Linear/Vercel aesthetic** — NOT generic shadcn defaults. Premium, refined, professional.
- Light/dark mode via `next-themes` (`ThemeProvider` in root layout, `attribute="class"`, `defaultTheme="system"`)
- Theme toggle (sun/moon) in dashboard topbar (`src/components/theme-toggle.tsx`)
- Sidebar: light in light mode, dark in dark mode (uses `--sidebar-*` CSS tokens)
- Dashboard sidebar uses **shadcn Sidebar component** (`SidebarProvider`, `collapsible="icon"`, `SidebarRail`, built-in mobile Sheet) — NOT a custom sidebar
- `mobile-sidebar.tsx` is deprecated (shadcn Sidebar handles mobile automatically)
- 13px body text, tight spacing, Geist font family
- `--brand` CSS variable for per-organization theming (default: `oklch(0.704 0.193 32)` — Loyalshy coral; merchants can override per-org)
- OKLCH color space throughout — all tokens in `globals.css` `:root` / `.dark`
- `TooltipProvider` wraps via `SidebarProvider` (NOT root layout)
- **Studio editor** — Figma/Canva-inspired canvas-first layout. **Desktop**: floating vertical icon toolbar with hover tooltips (left edge), floating rounded context panel (slides in from left), full-width canvas. `FloatingToolMenu` + `ContextPanel` from `context-notch.tsx`. Clicking card elements opens the corresponding tool panel. **Mobile**: full-screen immersive mode (topbar, tab nav, subscription banners hidden via `hidden md:block`; content padding removed). Canva-style horizontally scrollable tool bar at bottom with all tools visible (no "More" overflow). Action row above tools with undo/redo, Apple/Google format toggle, and save button. Bottom sheet panels with drag handle pill, swipe-to-dismiss gesture (80px threshold), backdrop overlay, slide-up animation. `MobileBottomSheet` component in `studio-layout.tsx` replaces `PanelShell` for mobile. Program layout uses `flex flex-col gap-6` (not `space-y-6`) so hidden tab nav doesn't create spacing gaps. Dedicated "Fields & Labels" panel combines text/label color controls with field management. Full-rounded (pill) styling on all interactive controls.

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
| DNS / CDN | Cloudflare | Free tier, pairs with R2 |

For full deployment guide, checklist, and cost estimate, see **`docs/deployment-stack.md`**.
For email setup (Cloudflare Email Routing + Gmail + Resend SMTP), see **`docs/email-setup.md`**.

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

### Landing Page (+ Public + Auth) — Warm Hospitality Aesthetic
Friendliest way to run a loyalty program. Warm, confident, never corporate.
Scoped via `[data-brand="loyalshy"]` wrapper on `src/app/page.tsx`, `src/app/(auth)/layout.tsx`, and `src/app/(public)/layout.tsx`. See **Phase BRAND-2026-04-28** for the full token mechanism.

**Typography**
- Inter for body/UI (loaded via `next/font/google` as `--font-inter`)
- Cabinet Grotesk for `:is(h1,h2,h3,h4,.font-display)` inside `[data-brand]` (loaded via Fontshare CDN — Indian Type Foundry, not on Google Fonts)
- Display headings: oversized, fluid sizing — `clamp(2.5rem, 6vw, 5rem)`
- Tracking: tight on large display (-0.02em via `[data-brand="loyalshy"] :is(h1,h2,h3,h4)`)
- Sentence case ALWAYS — never Title Case, never ALL CAPS

**Color**
- Coral `#FF6B47` / `oklch(0.704 0.193 32)` — hero accent, CTAs, focus rings
- Cream `#FFF8F1` / `oklch(0.985 0.011 81)` — background (replaces white)
- Ink `#1F1410` / `oklch(0.187 0.021 38)` — text (replaces black, slight coral undertone)
- Hero highlight uses `mk-gradient-text`: coral → deeper coral `oklch(0.62 0.215 28)` (the `--mk-brand-purple` and `--mk-brand-green` tokens are repurposed inside `[data-brand]` for this gradient)
- Supporting palette (mint, butter, plum, sky) is documented in the brand board but NOT yet wired as tokens — add as needed for category differentiation
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
