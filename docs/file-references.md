# Loyalshy — File References

Detailed file-by-file reference for each feature area. Extracted from CLAUDE.md to keep it under the context size limit.

## Key Dashboard Files

- `src/app/(dashboard)/layout.tsx` — Suspense wrapper → DashboardLayoutInner (async: connection() + getCurrentUser() + no-restaurant redirect + restaurant/org role fetch + subscriptionStatus/trialEndsAt) → DashboardShell. noindex robots metadata.
- `src/components/dashboard/dashboard-shell.tsx` — Client orchestrator (sidebar + topbar + command palette + mobile nav + trial/past-due subscription banners)
- `src/components/dashboard/sidebar.tsx` — Collapsible desktop sidebar (240px ↔ 60px)
- `src/components/dashboard/topbar.tsx` — Breadcrumbs + search (Cmd+K) + "Register Visit" CTA
- `src/components/dashboard/command-palette.tsx` — Cmd+K: quick actions + page navigation
- `src/components/dashboard/mobile-nav.tsx` — 5-tab bottom nav with center Visit+ FAB (Overview, Customers, Visit+, Rewards, More)
- `src/components/dashboard/mobile-sidebar.tsx` — Sheet sidebar for mobile hamburger

## Key Customer Management Files

- `src/app/(dashboard)/dashboard/customers/page.tsx` — Server Component: reads searchParams, calls getCustomers, renders CustomersView
- `src/app/(dashboard)/dashboard/customers/loading.tsx` — Skeleton loader matching table layout
- `src/server/customer-actions.ts` — Server actions: getCustomers (paginated/filtered/sorted, excludes soft-deleted), getCustomerDetail, addCustomer (plan customer limit check, sanitized), updateCustomer (sanitized), deleteCustomer (soft delete via deletedAt), exportCustomersCSV, exportCustomerData (GDPR, owner-only)
- `src/components/dashboard/customers/customers-view.tsx` — Client orchestrator: manages sheet state, renders table + filters + empty state
- `src/components/dashboard/customers/customer-table.tsx` — TanStack Table with server-side pagination, sorting, URL param updates
- `src/components/dashboard/customers/customer-columns.tsx` — Column definitions: Name (avatar+contact), Progress (mini bar), Total, Last Visit, Wallet badge, Actions dropdown
- `src/components/dashboard/customers/customer-filters.tsx` — Search input (debounced) + wallet status chips + "Has Reward" chip + CSV export
- `src/components/dashboard/customers/add-customer-sheet.tsx` — Sheet form: Full Name*, Email, Phone with Zod validation + duplicate detection
- `src/components/dashboard/customers/customer-detail-sheet.tsx` — Detail sheet: progress ring, stats, visit/reward tabs, edit dialog, delete confirmation
- `src/components/dashboard/customers/customer-progress-ring.tsx` — SVG circular progress (currentCycleVisits / visitsRequired)
- `src/components/dashboard/customers/customer-empty-state.tsx` — Friendly empty state with "Add your first customer" CTA

## Key Visit Registration Files

- `src/server/visit-actions.ts` — Server actions: searchCustomersForVisit (debounced, returns customers + visitsRequired), registerVisit (DAL auth, 1-min double-reg prevention, transaction, reward creation on cycle complete, wallet update via Trigger.dev)
- `src/components/dashboard/register-visit-dialog.tsx` — Multi-step dialog: Search → Confirm (stamp card) → Success (animated checkmark / reward celebration with confetti). Auto-dismisses after 2.5s.
- `src/components/dashboard/dashboard-shell.tsx` — Wired up RegisterVisitDialog (topbar CTA + command palette trigger)
- `src/components/dashboard/customers/customer-detail-sheet.tsx` — Added "Register Visit" button in actions footer (onRegisterVisit prop)
- `src/components/dashboard/customers/customers-view.tsx` — Wired RegisterVisitDialog from customer detail sheet
- `src/app/globals.css` — Added keyframe animations: draw-check, scale-in, bounce-in, confetti-dot

## Key Reward Management Files

- `src/server/reward-actions.ts` — Server actions: getRewards (paginated/tabbed/searchable/date-filtered), getRewardStats (available, redeemed, redemption rate, avg days to redeem), redeemReward (DAL auth, validate AVAILABLE, transaction, increment customer totalRewardsRedeemed, wallet update via Trigger.dev), getRewardDetail
- `src/app/(dashboard)/dashboard/rewards/page.tsx` — Server Component: reads searchParams (tab, search, sort, order, page, dateFrom, dateTo), fetches rewards + stats, renders RewardsView
- `src/app/(dashboard)/dashboard/rewards/loading.tsx` — Skeleton loader matching rewards page layout
- `src/components/dashboard/rewards/rewards-view.tsx` — Client orchestrator: tabs (Available/Redeemed/Expired), filters, table, redeem dialog state
- `src/components/dashboard/rewards/reward-table.tsx` — TanStack Table with dynamic columns per tab (Available shows expires/redeem button, Redeemed shows redeemed date)
- `src/components/dashboard/rewards/reward-filters.tsx` — Search input (debounced) + date range (from/to) inputs with URL param updates
- `src/components/dashboard/rewards/redeem-reward-dialog.tsx` — Confirmation dialog: customer name, reward description, earned date, expiry, redeem button
- `src/components/dashboard/rewards/reward-stat-cards.tsx` — 4 stat cards: Available, Redeemed This Month, Redemption Rate %, Avg Days to Redeem
- `src/components/dashboard/rewards/reward-empty-state.tsx` — Empty state when no rewards exist
- `src/components/dashboard/customers/customer-detail-sheet.tsx` — Updated: Redeem button on each AVAILABLE reward in the Rewards tab
- `src/trigger/expire-rewards.ts` — Trigger.dev v4 scheduled task: daily CRON at 2am UTC, batch expire rewards, trigger wallet pass updates

## Key Settings Files

- `src/server/settings-actions.ts` — Server actions: getSettingsData (restaurant + program + team + invitations), updateRestaurantProfile, uploadRestaurantLogo (Vercel Blob), deleteRestaurantLogo, updateLoyaltyProgram (with reset progress option), getTeamMembers, inviteTeamMember (plan staff limit check + email via Trigger.dev), removeTeamMember, cancelInvitation, resendInvitation (email via Trigger.dev)
- `src/app/(dashboard)/dashboard/settings/page.tsx` — Server Component: assertRestaurantRole(owner), parallel fetches settings + billing data, renders SettingsView with tab param
- `src/app/(dashboard)/dashboard/settings/loading.tsx` — Skeleton loader matching settings layout
- `src/components/dashboard/settings/settings-view.tsx` — Client orchestrator: tab navigation (General/Loyalty Program/Team/Billing + QR Code link + Jobs link), URL param-driven
- `src/components/dashboard/settings/general-settings-form.tsx` — Restaurant name, address, phone, website, timezone, logo upload (Vercel Blob), brand color picker with wallet pass preview
- `src/components/dashboard/settings/loyalty-settings-form.tsx` — Visits required, reward description, expiry days, terms & conditions, active toggle, visits-changed warning with keep/reset progress options
- `src/components/dashboard/settings/team-management.tsx` — Team member list with roles, invite dialog (Staff/Owner role cards), remove member confirmation, pending invitations with resend/cancel
- `src/components/dashboard/settings/billing-settings.tsx` — Full billing page: current plan card, usage meters with progress bars, plan comparison grid with upgrade/switch buttons, trial/past-due banners, Stripe Checkout + Customer Portal integration

## Key Billing Files

- `src/lib/stripe.ts` — Stripe SDK singleton (lazy proxy), plan definitions (FREE/STARTER/PRO/ENTERPRISE with limits), price lookup key mapping, getPlanLimits(), isUpgrade() helpers (server-only)
- `src/server/billing-actions.ts` — Server actions: getBillingData (plan + usage + limits), createCheckoutSession, createPortalSession, checkCustomerLimit, checkStaffLimit
- `src/app/api/stripe/create-checkout/route.ts` — POST: creates Stripe Checkout session (creates Stripe customer if needed, resolves price from lookup key)
- `src/app/api/stripe/webhook/route.ts` — POST: Stripe webhook handler (signature verification, idempotency deduplication, handles checkout.session.completed, subscription.updated/deleted, invoice.payment_failed/paid)
- `src/app/api/stripe/portal/route.ts` — POST: creates Stripe Customer Portal session for billing management
- `src/components/dashboard/settings/billing-settings.tsx` — Full billing page: current plan, usage meters, plan comparison grid, upgrade buttons, trial/past-due banners
- `src/components/dashboard/dashboard-shell.tsx` — Updated: trial and past-due banners in main content area
- `src/trigger/process-stripe-webhook.ts` — Updated: full implementation of subscription event processing via Trigger.dev
- `scripts/seed-stripe.ts` — Seed script: creates Stripe products (Starter/Pro) with monthly prices and lookup keys, configures Customer Portal
- Plan enforcement: `src/server/customer-actions.ts` (addCustomer checks customer limit), `src/server/settings-actions.ts` (inviteTeamMember checks staff limit)

## Key Wallet Files

### Apple Wallet
- `src/lib/wallet/apple/constants.ts` — Pass type identifier, team identifier, organization name, web service base URL (from env)
- `src/lib/wallet/apple/colors.ts` — hexToPasskitRgb() converter, getPassColors() for brand-derived pass colors
- `src/lib/wallet/apple/certificates.ts` — Loads Apple certs from base64 env vars, module-scope singleton cache (server-only)
- `src/lib/wallet/apple/icons.ts` — Fetches restaurant logo from Vercel Blob URL, returns icon/logo buffers for pass, fallback placeholder PNG (server-only)
- `src/lib/wallet/apple/auth.ts` — validateApplePassAuth() validates "Authorization: ApplePass <token>" header against Customer.walletPassId (server-only)
- `src/lib/wallet/apple/generate-pass.ts` — PassGenerationInput type + generateApplePass(): builds PKPass with passkit-generator from buffers (no filesystem template, Vercel-compatible). Generic pass type with QR barcode, header/primary/secondary/auxiliary/back fields (server-only)
- `src/lib/wallet/apple/update-pass.ts` — notifyApplePassUpdate(): touches customer.updatedAt + creates WalletPassLog UPDATED (legacy sync path; APNs push now handled by Trigger.dev updateWalletPassTask) (server-only)
- `src/app/api/wallet/apple/[serialNumber]/route.ts` — GET: download .pkpass file by serial number
- `src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]/route.ts` — POST: register device for push, DELETE: unregister device
- `src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/route.ts` — GET: list serial numbers updated since timestamp
- `src/app/api/wallet/apple/v1/passes/[passTypeId]/[serialNumber]/route.ts` — GET: serve latest pass (If-Modified-Since support)
- `src/app/api/wallet/apple/v1/log/route.ts` — POST: receive Apple Wallet error logs

### Google Wallet
- `src/lib/wallet/google/constants.ts` — GOOGLE_WALLET_ISSUER_ID, API base URL, save base URL, buildClassId(restaurantId), buildObjectId(customerId) helpers
- `src/lib/wallet/google/credentials.ts` — Parses service account key from JSON/base64 env var, GoogleAuth client with wallet_object.issuer scope, getAccessToken() for API calls (server-only)
- `src/lib/wallet/google/jwt-utils.ts` — RS256 JWT signing with service account private key, signJwt(), buildSaveUrl() for "Save to Google Wallet" links (server-only)
- `src/lib/wallet/google/generate-pass.ts` — GooglePassGenerationInput type, buildGenericClass() (one per restaurant), buildGenericObject() (one per customer), generateGoogleWalletSaveUrl() — builds save URL with class + object in signed JWT (server-only)
- `src/lib/wallet/google/update-pass.ts` — notifyGooglePassUpdate(): fetches customer data, PATCHes generic object via Google Wallet REST API with OAuth2 token, logs WalletPassLog UPDATED (server-only)
- `src/server/wallet-actions.ts` — issueGoogleWalletPass() server action: DAL auth, generates save URL, updates customer wallet fields (walletPassId, walletPassType GOOGLE), creates WalletPassLog CREATED, returns save URL
- `src/app/api/wallet/google/save-url/route.ts` — POST: generate save-to-wallet URL (requires auth + restaurant scoping + rate limiting)
- `src/app/api/wallet/google/callback/route.ts` — POST: callback endpoint for Google Wallet status updates (logs only, processing in Phase 3.4)

### QR Code & Onboarding
- `src/server/onboarding-actions.ts` — Server actions: getRestaurantBySlug (public, no auth), joinLoyaltyProgram (rate-limited, sanitized input, create/find customer, issue Apple/Google pass, already-a-member detection)
- `src/app/(public)/join/[slug]/page.tsx` — Server Component: fetch restaurant by slug, generate metadata, render OnboardingForm
- `src/app/(public)/join/[slug]/onboarding-form.tsx` — Client Component: mobile-first form (name/email/phone), device detection (iOS→Apple, Android→Google, desktop→both), wallet pass download (Apple .pkpass auto-download, Google redirect to save URL), success/returning-member states
- `src/app/(public)/join/[slug]/loading.tsx` — Skeleton loader for join page
- `src/app/(public)/join/[slug]/not-found.tsx` — 404 page for invalid restaurant slugs
- `src/app/(dashboard)/dashboard/settings/qr-code/page.tsx` — Server Component: owner-only, restaurant QR code management page
- `src/app/(dashboard)/dashboard/settings/qr-code/loading.tsx` — Skeleton loader for QR settings page
- `src/components/dashboard/settings/qr-code-display.tsx` — Client Component: QR SVG preview (qrcode lib), logo overlay, URL copy, PNG download with size presets (receipt/table-tent/poster), canvas rendering with restaurant branding, NFC tag instructions
- `qrcode@1.5.4` + `@types/qrcode@1.5.6` installed for SVG/PNG QR generation

### Trigger.dev Background Jobs
- `trigger.config.ts` — Trigger.dev v4 config (project ref, dirs: ./src/trigger, maxDuration: 300, default retries with exponential backoff)
- `src/trigger/db.ts` — createDb() helper for Trigger.dev tasks (fresh PrismaClient per task, must $disconnect in finally)
- `src/trigger/queues.ts` — 5 queues: wallet-updates (10), notifications (5), analytics (2), billing (3), emails (5)
- `src/trigger/update-wallet-pass.ts` — updateWalletPassTask: Apple (touch updatedAt + APNs HTTP/2 push to registered devices) + Google (PATCH genericObject via REST API), WalletPassLog logging
- `src/trigger/expire-rewards.ts` — expireRewardsTask: daily 2am UTC CRON, batch update AVAILABLE→EXPIRED, batch trigger wallet pass updates
- `src/trigger/generate-analytics-snapshot.ts` — generateAnalyticsSnapshotTask: daily 3am UTC CRON, compute daily aggregates per restaurant, upsert AnalyticsSnapshot
- `src/trigger/send-invitation-email.ts` — sendInvitationEmailTask: Resend email with invitation link, styled HTML
- `src/trigger/send-welcome-email.ts` — sendWelcomeEmailTask: Resend welcome email with getting started tips, QR link, dashboard link
- `src/trigger/send-trial-reminder-email.ts` — sendTrialReminderEmailTask: daily 9am UTC CRON, sends reminders at 7/3/1 days before trial ends
- `src/trigger/process-stripe-webhook.ts` — processStripeWebhookTask: full Stripe event processing (subscription create/update/delete, invoice paid/failed, plan + status DB updates)
- `src/server/jobs-actions.ts` — getRecentJobLogs (paginated WalletPassLog query, OWNER only)
- `src/app/(dashboard)/dashboard/settings/jobs/page.tsx` — Server Component: owner-only, recent job activity
- `src/components/dashboard/settings/jobs-history.tsx` — Client Component: table with action badges, detail pills, pagination, refresh
- Server actions (visit-actions, reward-actions) dispatch wallet updates via `tasks.trigger("update-wallet-pass", ...)`
- Invitation emails (auth-actions, settings-actions) dispatched via `tasks.trigger("send-invitation-email", ...)`
- APNs push: Node.js HTTP/2 client, single session per batch, empty body push with passTypeIdentifier topic

## Key Onboarding & Landing Page Files

### Multi-step Registration Wizard
- `src/app/(auth)/register/page.tsx` — Client Component: 6-step wizard (Account → Restaurant → Branding → Loyalty → Trial → Done), URL param `?step=N`, Google OAuth + email/password step 1, password strength indicator
- `src/server/onboarding-registration-actions.ts` — Server actions: createRestaurant (slug generation + sanitized input + Restaurant + Organization + LoyaltyProgram + Member in transaction), updateRestaurantBranding, uploadOnboardingLogo (Vercel Blob), setupLoyaltyProgram, initializeTrialSubscription (Stripe customer + trial sub + welcome email), completeOnboarding, getOnboardingChecklist (auth-gated), dismissOnboardingChecklist

### Marketing Landing Page
- `src/app/page.tsx` — Server Component composing all marketing sections, JSON-LD structured data (SoftwareApplication), canonical URL
- `src/components/marketing/navbar.tsx` — Client Component: sticky nav with blur backdrop, mobile Sheet menu
- `src/components/marketing/hero.tsx` — Hero with CSS-only wallet pass mockup, floating animation
- `src/components/marketing/how-it-works.tsx` — 3-step visual guide with connected dots
- `src/components/marketing/features.tsx` — 2x3 feature grid with hover effects
- `src/components/marketing/pricing.tsx` — Server Component importing PLANS from stripe.ts, 3-column grid
- `src/components/marketing/testimonials.tsx` — 3 testimonial cards with deterministic avatar colors
- `src/components/marketing/faq.tsx` — Client Component with shadcn Accordion, 8 FAQ items
- `src/components/marketing/footer.tsx` — Dark footer with column links, copyright

### Onboarding Checklist
- `src/components/dashboard/onboarding-checklist.tsx` — Client Component: 5-item checklist (logo, loyalty, QR, customer, staff), progress bar, dismissible
- `src/app/(dashboard)/dashboard/page.tsx` — Updated: OnboardingChecklistSection with Suspense

### Layout & Proxy Updates
- `src/app/(auth)/layout.tsx` — max-w-xl (wider for wizard), Suspense wrapper for cacheComponents, noindex robots metadata
- `src/app/(dashboard)/layout.tsx` — Suspense wrapper for cacheComponents, no-restaurant redirect to `/register?step=2`, noindex robots metadata
- `proxy.ts` — Removed `/register` from auth page redirects (allows multi-step onboarding)

### Build Fixes (cacheComponents)
- `src/lib/auth.ts` — Lazy Resend client (getResend()) instead of eager construction
- `src/app/api/stripe/webhook/route.ts` — Uses lazy stripe proxy from `@/lib/stripe`
- `src/app/(auth)/invite/[token]/page.tsx` — Refactored to Server Component + invite-form.tsx Client Component
- All dashboard pages: `await connection()` from `next/server` for proper dynamic rendering
- `tsconfig.json` — Excluded `prisma/seed.ts` and `scripts/` from TypeScript build

## Key Error Handling & Polish Files

### Error Boundaries
- `src/app/global-error.tsx` — App-level error boundary (catches root layout errors, uses raw HTML/inline styles, reports to Sentry)
- `src/app/not-found.tsx` — Global 404 page
- `src/app/(dashboard)/error.tsx` — Dashboard layout error boundary
- `src/app/(dashboard)/dashboard/error.tsx` — Overview page error boundary
- `src/app/(dashboard)/dashboard/customers/error.tsx` — Customers page error boundary
- `src/app/(dashboard)/dashboard/rewards/error.tsx` — Rewards page error boundary
- `src/app/(dashboard)/dashboard/settings/error.tsx` — Settings page error boundary
- `src/app/(auth)/error.tsx` — Auth pages error boundary
- `src/app/(public)/join/[slug]/not-found.tsx` — QR onboarding 404

### Edge Case Handling
- `src/components/dashboard/dashboard-shell.tsx` — Subscription gate for CANCELED status (shows "Choose a plan" CTA), trial/past-due banners with aria-labels
- Server action `requireRestaurantId()`/`requireRestaurant()` helpers redirect("/register?step=2") instead of throwing
- Visit registration: "No active loyalty program found" typed error
- Plan limits: customer/staff limit checks return `{ allowed, current, limit, approaching }`

### Accessibility
- `aria-label` on all icon-only buttons: topbar, sidebar, customer table, reward filters, register visit, team management, jobs, dashboard shell
- `aria-invalid` + `aria-describedby` on form inputs with errors: add-customer-sheet, team invite dialog
- `role="alert"` on form error messages
- `aria-label="Main navigation"` on sidebar nav, `aria-label="Mobile navigation"` on mobile nav

## Key Responsive & Mobile Files

### Mobile Navigation
- `src/components/dashboard/mobile-nav.tsx` — 5-tab bottom nav: Overview, Customers, center Visit+ FAB, Rewards, More→Settings. 44px min touch targets. Safe-area-bottom padding.
- `src/components/dashboard/dashboard-shell.tsx` — `onOpenRegisterVisit` → MobileNav, `pb-[72px]` bottom padding

### Responsive Patterns
- Register visit dialog: mobile near-full-height (`max-md:h-[85dvh]`), viewport-relative scroll, touch-friendly rows, haptic feedback, dynamic stamp grid
- Customer detail sheet: `flex-wrap`, viewport-relative scroll `h-[40vh] min-h-[180px]`
- Customer table: `overflow-x-auto`, `py-3` rows, `icon-sm` pagination
- Reward table: dual rendering — mobile card list below `md`, desktop table above `md`, responsive column hiding
- Overview page: `md:grid-cols-2` for secondary charts, responsive activity+customers grid
- Visits chart: responsive height `h-[200px] sm:h-[260px]`

### Safe Areas & Viewport
- `src/app/globals.css` — `.safe-area-bottom` / `.safe-area-top` utilities
- `src/app/layout.tsx` — `viewport` with `viewportFit: "cover"`, `themeColor`, Toaster `top-center`, AnalyticsProvider, full SEO metadata

### PWA
- `public/manifest.json` — Standalone display, dark theme, start URL `/dashboard`
- `public/icon-192.png` + `public/icon-512.png` — Placeholder PWA icons

## Key Security Files

### Security Infrastructure
- `next.config.ts` — Security headers (X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- `src/lib/env.ts` — Zod env validation, lazy validation on first access, typed `env()` function (server-only)
- `src/lib/sanitize.ts` — `sanitizeText()`: strips control chars, collapses spaces, trims, enforces max length
- `src/lib/rate-limit.ts` — In-memory sliding window rate limiter, `publicFormLimiter` (10/min), `apiRouteLimiter` (20/min)

### Auth Fixes
- `src/server/auth-actions.ts` — `acceptStaffInvitation` verifies email match; `validateInvitationToken` rate-limited
- `src/server/onboarding-registration-actions.ts` — `getOnboardingChecklist` requires auth + restaurant ownership
- `src/app/api/wallet/google/save-url/route.ts` — DAL auth + restaurant scoping + rate limiting

### Customer Soft Delete (GDPR)
- Customer model has `deletedAt DateTime?` + `@@index([restaurantId, deletedAt])`
- All customer queries filter `deletedAt: null` (customer-actions, visit-actions, analytics)
- `exportCustomerData` GDPR export (owner-only)

### Input Sanitization Applied
- customer-actions (add/update), onboarding-actions (join), settings-actions (profile), onboarding-registration-actions (create restaurant)

### Rate Limiting Applied
- `joinLoyaltyProgram` (10/min per IP), `validateInvitationToken` (10/min per IP), Google save-url (20/min per session)

### Other Hardening
- Password strength indicator, Stripe webhook idempotency, PII audit (sanitized console.error)

## Key Testing Files

### Test Configuration
- `vitest.config.ts` — node environment, path alias (`@/` → `./src/`), coverage via v8
- `playwright.config.ts` — chromium + iPhone 14, webServer auto-start
- `src/__tests__/setup.ts` — Mocks `server-only`, `next/cache`, `next/navigation`, `next/headers`, `next/server`
- `src/__tests__/mocks/db.ts` — Mock Prisma client factory (`createMockDb()`)
- `src/__tests__/mocks/auth.ts` — Mock auth factories: `createMockSession()`, `createMockMember()`, etc.

### Unit Tests (50 tests)
- `src/lib/sanitize.test.ts` (11), `src/lib/stripe.test.ts` (18), `src/lib/wallet/apple/colors.test.ts` (11), `src/lib/wallet/google/constants.test.ts` (3), `src/lib/rate-limit.test.ts` (7)

### Integration Tests (43 tests)
- `src/server/visit-actions.test.ts` (11), `src/server/reward-actions.test.ts` (9), `src/server/billing-actions.test.ts` (9), `src/lib/dal.test.ts` (14)

### E2E Tests (Playwright stubs)
- `e2e/auth.spec.ts`, `e2e/landing.spec.ts`, `e2e/qr-onboarding.spec.ts`

## Key Performance & SEO Files

### SEO
- `src/app/layout.tsx` — Root metadata: metadataBase, openGraph, twitter, robots, keywords, title template
- `src/app/sitemap.ts` — Dynamic sitemap.xml (landing, login, register)
- `src/app/robots.ts` — robots.txt (allow /, disallow /dashboard, /api, /join)
- `src/app/opengraph-image.tsx` — Auto-generated OG image (1200x630, dark gradient, feature pills)
- `src/app/page.tsx` — JSON-LD structured data, canonical URL
- Auth + dashboard layouts — noindex; `/join/[slug]` — dynamic openGraph per restaurant

### Monitoring & Analytics
- `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` — Sentry init
- `src/instrumentation.ts` — Next.js instrumentation, loads Sentry configs
- `next.config.ts` — withSentryConfig wrapper (source map upload when SENTRY_AUTH_TOKEN set)
- `src/components/analytics-provider.tsx` — Plausible analytics (env-gated)

### Performance
- `prisma/schema.prisma` — Composite indexes: Visit[restaurantId,createdAt], Visit[customerId,createdAt], Reward[restaurantId,status], Reward[restaurantId,expiresAt], Customer[restaurantId,totalVisits]
- Debounce fixes: customer-filters (useRef pattern), register-visit-dialog (300ms)
- `src/components/dashboard/sidebar.tsx` — router.prefetch on hover

## Wallet Provider Setup

### Apple Certificate Setup

1. Obtain Apple Developer Pass Type ID certificate from developer.apple.com
2. Export as .pem files (signer cert + signer key)
3. Download Apple WWDR G4 certificate
4. Base64-encode each file: `base64 -i cert.pem | tr -d '\n'`
5. Set env vars: APPLE_PASS_TYPE_IDENTIFIER, APPLE_TEAM_IDENTIFIER, APPLE_PASS_CERTIFICATE, APPLE_PASS_KEY, APPLE_PASS_KEY_PASSPHRASE, APPLE_WWDR_CERTIFICATE

### Google Cloud Console Setup

1. Create a Google Cloud project (or use existing)
2. Enable the Google Wallet API in the API Library
3. Create a service account with "Google Wallet Object Creator" role
4. Generate a JSON key for the service account
5. Go to Google Pay & Wallet Console → create an Issuer account, note the Issuer ID
6. Set env vars: GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_KEY (full JSON key or base64-encoded)
