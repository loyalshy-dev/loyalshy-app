# Claude Code Development Plan
## Digital Loyalty Card SaaS — Industry-Standard, Polished UX

> **Last Updated:** February 25, 2026 — v4
> **Stack versions verified and current as of this date.**
> **v4 changes:** Fixed 19 issues across two audit passes — see changelog at bottom.

---

## Stack Versions (Verified February 2026)

| Technology | Version | Notes |
|------------|---------|-------|
| **Next.js** | 16.1 | Turbopack default, Cache Components, `proxy.ts` replaces middleware |
| **React** | 19.2 | View Transitions, useEffectEvent, Activity |
| **Prisma ORM** | 7.4 | Rust-free TypeScript client, query caching, `prisma.config.ts` |
| **PostgreSQL** | 18.2 | uuidv7(), 3× I/O improvements, virtual generated columns |
| **Better Auth** | 1.4.x | Successor to Auth.js/NextAuth, framework-agnostic, Prisma adapter |
| **Stripe** | 20.3.1 (node) / 8.8.0 (stripe-js) | API version 2026-01-28.clover |
| **Trigger.dev** | 4.4.1 (v4 GA) | Warm machine reuse, human-in-the-loop, new Run Engine |
| **Tailwind CSS** | 4.2 | CSS-native config via `@theme`, no `tailwind.config.js` |
| **shadcn/ui** | 3.8.5 (CLI) | Unified Radix UI package, RTL support, Base UI blocks |
| **Resend** | latest | Transactional email for invitations, password reset, trial reminders |
| **Vercel Blob** | latest | File uploads (logos, images) — ephemeral-safe storage |

### Key Migration Notes from Older Tutorials

If you're following older guides or tutorials, watch out for these changes:

- **Next.js 16:** `middleware.ts` is now `proxy.ts`. All `params` and `searchParams` are async. The experimental PPR flag is removed — use Cache Components instead (`cacheComponents: true` in next.config.ts). Turbopack is the default bundler.
- **Next.js 16 Auth Pattern:** `proxy.ts` should ONLY do optimistic cookie checks and redirects. Real authorization (session validation, role checks, DB queries) must happen in Server Components, Server Actions, or a Data Access Layer. This is an official Next.js recommendation.
- **Prisma 7:** Uses `prisma.config.ts` instead of just `schema.prisma` for configuration. The client is now pure TypeScript (no Rust binary). Mapped enums are supported. Use `@map` on enum members.
- **Better Auth replaces NextAuth:** Auth.js/NextAuth v5 never left beta and was absorbed by Better Auth. Better Auth has built-in 2FA, multi-tenant, organizations, and works with Prisma adapter natively. Custom user fields require `additionalFields` in the auth config. The organization plugin requires its own tables (Organization, Member) — let Better Auth's CLI generate these via `npx @better-auth/cli generate`.
- **Tailwind v4:** All config is CSS-native using `@theme` directive. No `tailwind.config.js`. Uses OKLCH colors by default. For Next.js, use `@tailwindcss/postcss` (NOT the Vite plugin — Next.js 16 uses Turbopack).
- **Trigger.dev v4:** Queues must be defined in code before deployment (no dynamic creation). Warm starts are 100-300ms. New `npx trigger.dev@latest update` upgrade path.
- **PostgreSQL 18:** Use `@default(dbgenerated("uuidv7()"))` in Prisma for time-sorted UUIDs with better index performance than uuid v4.

---

## Architecture Decision: Auth Pattern

This is important enough to call out separately:

```
┌──────────────────────────────────────────────────────┐
│  proxy.ts (runs on EVERY request)                     │
│  ─────────────────────────────────────────────────── │
│  • Read session cookie (optimistic, fast)             │
│  • Redirect unauthenticated users to /login           │
│  • Redirect authenticated users away from /login      │
│  • NO database calls                                  │
│  • NO heavy logic                                     │
│  • NO role checks                                     │
└──────────────────────────────┬───────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────┐
│  Data Access Layer (DAL) — /src/lib/dal.ts            │
│  ─────────────────────────────────────────────────── │
│  • getCurrentUser(): validate session against DB      │
│  • assertRestaurantAccess(restaurantId)               │
│  • assertRestaurantRole(restaurantId, role)            │
│  • All server actions call DAL before mutations       │
│  • All Server Components call DAL for auth data       │
│  • This is the REAL security boundary                 │
└──────────────────────────────────────────────────────┘
```

DO NOT rely on proxy.ts for security. It's a UX optimization (fast redirects),
not a security boundary. Every page and every server action must independently
verify the session and permissions via the DAL.

---

## Overview

This is a step-by-step plan designed to be executed with **Claude Code** from terminal. Each phase is a self-contained prompt block you can paste into Claude Code. The plan builds the project incrementally, ensuring each layer works before moving to the next.

**Goal:** Production-grade SaaS with polished, modern UX — not a prototype.

---

## Phase 0 — Project Bootstrap & Foundation

### Prompt 0.1 — Initialize Project

```
Initialize a new Next.js 16 project with App Router and TypeScript.
Use pnpm as the package manager.

Install and configure:
- Tailwind CSS v4.2 (CSS-native config, no tailwind.config.js)
  - Use @tailwindcss/postcss (NOT the Vite plugin — Next.js uses Turbopack)
  - Set up @theme directive in globals.css with OKLCH color palette
- Prisma ORM v7 with PostgreSQL provider
  - Use prisma.config.ts for configuration
  - Enable the Rust-free TypeScript client (default in v7)
- Better Auth v1.4.x with Prisma adapter
  - Email/password credentials + Google OAuth
  - Configure session strategy
- Stripe SDK (stripe@^20, @stripe/stripe-js@^8)
- Trigger.dev v4 SDK (@trigger.dev/sdk@^4)
- shadcn/ui (init with default config, New York style)
  - Uses unified Radix UI package
- Resend for transactional email (@react-email/components + resend)
- @vercel/blob for file uploads (logos, images — Vercel is ephemeral)
- Lucide React icons
- Zod for validation
- React Hook Form
- date-fns
- Sonner for toast notifications
- Nuqs for URL search params
- TanStack Table for data tables

Set up the folder structure:
/src
  /app              → App Router pages
    /(auth)         → Login/Register/Forgot password
    /(dashboard)    → Protected dashboard routes
    /(public)       → Public landing, pricing, QR scan pages
    /api            → API routes
  /components       → Reusable UI components
    /ui             → Shadcn components
    /dashboard      → Dashboard-specific components
    /marketing      → Landing page components
    /wallet         → Wallet pass components
  /lib              → Utilities, db client, auth config, DAL
  /server           → Server actions
  /trigger          → Trigger.dev job definitions
  /types            → TypeScript type definitions
  /hooks            → Custom React hooks
  /emails           → React Email templates
  /styles           → Global styles

IMPORTANT Next.js 16 specifics:
- Use proxy.ts (NOT middleware.ts) for OPTIMISTIC route redirects only
  proxy.ts should NOT do DB calls or heavy auth logic — just cookie checks
- All params and searchParams must be awaited (async access)
- Enable Cache Components in next.config.ts:
  cacheComponents: true
  Then use `use cache` directive in components for caching
- Turbopack is the default bundler — no additional config needed
- React Compiler is available but not enabled by default — enable it
  in next.config.ts with: reactCompiler: true

IMPORTANT Tailwind v4 specifics:
- No tailwind.config.js file — all config in CSS via @theme
- Import with: @import "tailwindcss"; in your main CSS file
- Define custom theme tokens with @theme { --color-brand: oklch(...) }
- Use @tailwindcss/postcss for Next.js integration

IMPORTANT Email setup:
- Configure Resend with API key in .env
- Create email templates using React Email in /emails
- Templates needed: welcome, invitation, password-reset, trial-reminder

Create a .env.example with all required environment variables documented,
including:
- DATABASE_URL
- BETTER_AUTH_SECRET
- BETTER_AUTH_URL
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
- STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET
- TRIGGER_SECRET_KEY
- RESEND_API_KEY
- BLOB_READ_WRITE_TOKEN (Vercel Blob for file uploads)
- APPLE_PASS_* (documented, not required for Phase 0)
- GOOGLE_WALLET_* (documented, not required for Phase 0)

Set up path aliases with @ pointing to /src.
```

### Prompt 0.2 — Database Schema

```
Create the Prisma schema for a multi-tenant loyalty card SaaS.

Use Prisma v7 conventions:
- prisma.config.ts for project configuration
- Use @default(dbgenerated("uuidv7()")) for ALL primary key UUIDs
  This generates time-sorted UUIDs from PostgreSQL 18 for better index perf
- Use mapped enums with @map where useful for clean database values

IMPORTANT: Better Auth requires specific tables with specific column names.
The User, Session, Account, and Verification models MUST follow Better Auth's
core schema. Custom fields on User (like restaurantId) must be added
via Better Auth's `user.additionalFields` config — NOT just as random columns.
See: https://www.better-auth.com/docs/concepts/database

IMPORTANT: Better Auth's organization plugin requires additional tables.
DO NOT define Organization or Member models manually in the Prisma schema.
Instead, after configuring the organization plugin in auth.ts (Phase 0.3),
run: npx @better-auth/cli generate
This will add the Organization, Member, and Invitation tables that the
plugin needs. Our custom Invitation model (model #11) is SEPARATE from
Better Auth's invitation table — ours handles custom staff invite logic
with tokens and expiry, while Better Auth's handles org membership invites.
Rename our model to StaffInvitation to avoid conflicts.

ROLE SYSTEM DESIGN DECISION:
- User.role (via additionalFields) = GLOBAL role only. Values: USER (default)
  or SUPER_ADMIN. That's it. No OWNER/STAFF here.
- Restaurant-level roles (OWNER, STAFF) live in Better Auth's organization
  Member table as the member's role within that organization.
- The DAL checks BOTH: User.role for super-admin access, and organization
  membership role for restaurant-level permissions.
This prevents the confusing dual-role system where both User.role and
org membership could say different things.

Models needed:

1. User — authentication account (extends Better Auth's user schema)
   Required by Better Auth: id, name, email, emailVerified, image, createdAt, updatedAt
   Custom fields (via additionalFields):
   - role: enum (SUPER_ADMIN, USER) — default USER
     This is for GLOBAL roles only. Restaurant-level OWNER/STAFF
     is handled by Better Auth's organization membership roles.
   - restaurantId: optional FK to Restaurant (convenience shortcut,
     null for super admins; canonical source is org membership)

2. Session — required by Better Auth (use their exact schema)
   Required: id, expiresAt, token, createdAt, updatedAt, ipAddress,
   userAgent, userId

3. Account — required by Better Auth for OAuth (use their exact schema)
   Required: id, accountId, providerId, userId, accessToken,
   refreshToken, idToken, accessTokenExpiresAt, refreshTokenExpiresAt,
   scope, password, createdAt, updatedAt

4. Verification — required by Better Auth (use their exact schema)
   Required: id, identifier, value, expiresAt, createdAt, updatedAt

5. Restaurant — tenant
   - id, name, slug (unique, URL-friendly)
   - logo (URL), brandColor (hex), secondaryColor (hex)
   - address, phone, website, timezone
   - subscriptionStatus: enum (TRIALING, ACTIVE, PAST_DUE, CANCELED, FREE)
   - stripeCustomerId, stripeSubscriptionId
   - plan: enum (FREE, STARTER, PRO, ENTERPRISE)
   - settings: Json (onboarding checklist state, etc.)
   - trialEndsAt: DateTime (nullable)
   - createdAt, updatedAt

6. LoyaltyProgram — each restaurant has one active program
   - id, restaurantId
   - name (e.g. "Burger Loyalty Card")
   - visitsRequired (default 10)
   - rewardDescription (e.g. "Free Burger")
   - rewardExpiryDays (default 90, 0 = never)
   - isActive: Boolean
   - termsAndConditions: Text (optional)
   - createdAt, updatedAt

7. Customer — end user (restaurant's customer)
   - id, restaurantId
   - fullName, email (optional), phone (optional)
   - walletPassId (unique identifier for wallet pass)
   - walletPassSerialNumber
   - walletPassType: enum (APPLE, GOOGLE, NONE)
   - currentCycleVisits: Int (default 0) — resets to 0 when reward earned
   - totalVisits: Int (default 0) — never resets
   - totalRewardsRedeemed: Int (default 0)
   - lastVisitAt: DateTime (nullable)
   - createdAt, updatedAt
   - unique constraint on [restaurantId, email]
   - unique constraint on [restaurantId, phone]
   NOTE on nullable unique constraints: PostgreSQL treats NULLs as distinct
   in unique indexes, so multiple customers with NULL email are allowed.
   This is the desired behavior — uniqueness only enforced when provided.
   Do NOT add WHERE NOT NULL partial indexes; the default behavior is correct.

8. Visit — each stamp/check-in
   - id, customerId, restaurantId, loyaltyProgramId
   - registeredById (User who registered it)
   - visitNumber (which visit in current cycle, 1-10)
   - createdAt

9. Reward — when a customer earns a free item
   - id, customerId, restaurantId, loyaltyProgramId
   - status: enum (AVAILABLE @map("available"), REDEEMED @map("redeemed"),
     EXPIRED @map("expired"))
   - earnedAt, redeemedAt, expiresAt
   - redeemedById (User who marked it redeemed, nullable)

10. WalletPassLog — audit trail for pass updates
    - id, customerId
    - action: enum (CREATED, UPDATED, PUSH_SENT, PUSH_FAILED)
    - details: Json
    - createdAt

11. StaffInvitation — custom staff invitations (NOT Better Auth's org invitation)
    - id, restaurantId, email, role (OWNER or STAFF — org membership role)
    - token (unique), expiresAt
    - accepted: Boolean (default false)
    - createdAt
    Note: Better Auth's organization plugin has its own Invitation table
    for org membership invites. This model is our custom flow with
    branded emails, token-based acceptance, and role pre-assignment.

12. DeviceRegistration — Apple Wallet push notification devices
    - id
    - deviceLibraryIdentifier: String
    - pushToken: String
    - serialNumber: String (FK to Customer.walletPassSerialNumber)
    - createdAt, updatedAt
    - unique constraint on [deviceLibraryIdentifier, serialNumber]

13. AnalyticsSnapshot — pre-computed daily metrics per restaurant
    - id, restaurantId
    - date: DateTime (the day this snapshot represents)
    - totalCustomers: Int
    - newCustomers: Int
    - totalVisits: Int
    - rewardsEarned: Int
    - rewardsRedeemed: Int
    - createdAt
    - unique constraint on [restaurantId, date]

Add proper indexes on:
- Customer: restaurantId, walletPassSerialNumber, email
- Visit: customerId, restaurantId, createdAt
- Reward: customerId, status
- Restaurant: slug, stripeCustomerId
- DeviceRegistration: serialNumber
- AnalyticsSnapshot: restaurantId + date

Use Prisma v7 partial indexes (preview feature) where useful,
e.g. on Reward where status = 'available'.

Add cascading deletes where appropriate.
Generate the migration and seed file with a demo restaurant and sample data.
```

### Prompt 0.3 — Auth Configuration

```
Set up Better Auth v1.4.x for authentication.

Better Auth is the successor to Auth.js/NextAuth. It's framework-agnostic
and has a Prisma adapter. Do NOT use next-auth — use better-auth.

1. Install:
   pnpm add better-auth
   pnpm add @better-auth/prisma  (if separate adapter package needed)

2. Create auth configuration at /src/lib/auth.ts:
   - Use betterAuth() with Prisma adapter
   - Configure emailAndPassword plugin with email verification
   - Configure Google OAuth provider
   - Use Better Auth's organization plugin for multi-tenant access:
     - Each Restaurant maps to an Organization
     - Staff are members of the organization
     - Organization-level roles: OWNER and STAFF (these are org membership
       roles, NOT User.role values)
     - User.role is only for global access: USER (default) or SUPER_ADMIN
   - Configure user.additionalFields to add custom fields:
     - role: enum USER | SUPER_ADMIN (global only, not restaurant-level)
     - restaurantId (convenience FK, canonical source is org membership)
   - Configure email sending via Resend:
     - Verification emails
     - Password reset emails
     - Invitation emails (or handle these manually)
   - Set trustedOrigins for production domain

3. Create the auth client at /src/lib/auth-client.ts:
   - Use createAuthClient() from "better-auth/react"
   - Export useSession, signIn, signUp, signOut hooks

4. Create API route handler:
   - /src/app/api/auth/[...all]/route.ts
   - Export GET and POST handlers from Better Auth's toNextJsHandler

5. Custom auth pages:
   - /login — email + password, Google OAuth button
   - /register — sign up form
   - /forgot-password — password reset flow
   These are regular Next.js pages using Better Auth's client SDK.

6. Create Data Access Layer (DAL) at /src/lib/dal.ts:
   This is the REAL security boundary. NOT proxy.ts.

   - getCurrentUser(): validates session against DB via Better Auth's
     auth.api.getSession(), returns typed user with restaurant info
     and organization membership (including org role: OWNER/STAFF)
   - Use React's cache() to deduplicate within a single render pass
   - assertAuthenticated(): throws or redirects if no valid session
   - assertSuperAdmin(): checks User.role === SUPER_ADMIN (global role)
   - assertRestaurantAccess(restaurantId): verifies user is a member of
     the restaurant's organization (via Better Auth org membership)
   - assertRestaurantRole(restaurantId, "OWNER"): checks org membership
     role — e.g., only OWNER can access billing/team settings
   - getRestaurantForUser(): returns the user's restaurant with plan info

   ROLE CHECK CHEAT SHEET:
   - "Is this user a super admin?" → check User.role (global)
   - "Can this user access this restaurant?" → check org membership exists
   - "Is this user an owner of this restaurant?" → check org membership role
   - "Is this user staff at this restaurant?" → check org membership role

   Every Server Component and Server Action MUST call DAL functions.
   Never trust proxy.ts for security — it only does optimistic redirects.

7. Route protection via proxy.ts (optimistic only):
   - Read session cookie using Better Auth's getSessionCookie()
     from "better-auth/cookies"
   - If no cookie: redirect to /login
   - If cookie exists AND path is /login or /register: redirect to /dashboard
   - NO database calls in proxy.ts
   - NO role checks in proxy.ts
   - This is a UX optimization, NOT a security boundary

8. Invitation acceptance flow:
   - /invite/[token] page
   - Validates token, shows registration form pre-filled with email
   - On submit: creates user via Better Auth, adds to restaurant's
     organization, marks invitation accepted
   - Send invitation emails via Resend

Better Auth docs: https://www.better-auth.com/docs
Prisma adapter: https://www.better-auth.com/docs/adapters/prisma
Organization plugin: https://www.better-auth.com/docs/plugins/organization
```

---

## Phase 1 — Dashboard Layout & Core UX

### Prompt 1.1 — Dashboard Shell & Navigation

```
Build the dashboard layout shell with a polished, modern SaaS aesthetic.

Design direction: Clean, refined, professional — think Linear or Vercel dashboard.
NOT generic shadcn defaults. Make it feel premium.

IMPORTANT: Use Tailwind v4 CSS-native theming:
- Define all design tokens in @theme { } in your CSS
- Use CSS variables for brand colors so each restaurant can be themed
- Use OKLCH color space for vibrant, consistent colors
- No tailwind.config.js — everything in CSS

IMPORTANT: Auth in layouts uses the DAL, not proxy.ts:
- The dashboard layout.tsx must call getCurrentUser() from the DAL
- If no valid session, redirect to /login from the Server Component
- Pass user/restaurant data to client components via props
- proxy.ts only provides an optimistic redirect — the layout is the real guard

Requirements:

1. Sidebar navigation (collapsible on desktop, sheet on mobile):
   - Restaurant logo + name at top (from getCurrentUser().restaurant)
   - Nav items with icons:
     - Overview (home/chart icon)
     - Customers (users icon)
     - Rewards (gift icon)
     - Settings (gear icon)
   Note: there is no dedicated /dashboard/visits page. Visit registration
   is done via the quick action button, command palette, or customer detail.
   Visit history is shown per-customer in the customer detail panel.
   - Active state with subtle highlight
   - User avatar + name at bottom with dropdown (profile, logout)
   - Collapse to icon-only mode
   - Settings sub-items visible only for OWNER role

2. Top bar:
   - Breadcrumb navigation
   - Quick action button: "Register Visit" (primary CTA always visible)
   - Notification bell (placeholder)
   - Command palette trigger (Cmd+K)

3. Command palette (Cmd+K):
   - Search customers by name, email, phone
   - Quick actions: Register Visit, Add Customer, Redeem Reward
   - Navigate to any page

4. Responsive: sidebar collapses to bottom tab bar on mobile

5. Page transitions: use React 19.2 View Transitions API
   for smooth route change animations

Use CSS variables for the brand color system so each restaurant's
dashboard can be subtly themed. Default to a sophisticated dark
sidebar with light content area.

Make every detail count: proper spacing, consistent icon sizing,
smooth hover states, focus rings for accessibility.
```

### Prompt 1.2 — Overview Dashboard Page

```
Build the /dashboard overview page with real-time stats and charts.

This is the first thing restaurant owners see. It should feel
informative and satisfying — like checking a stock portfolio.

IMPORTANT: Use Next.js 16 Cache Components where appropriate:
- cacheComponents: true is enabled in next.config.ts
- Use `use cache` for data that doesn't change every request
- Use Suspense boundaries for streaming
- All params/searchParams must be awaited
- Always call getCurrentUser() from DAL first — don't cache user-specific data

Components:

1. Stat Cards Row (animated count-up on load):
   - Total Customers (with % change from last month)
   - Visits This Month (with % change)
   - Active Rewards (available to redeem)
   - Rewards Redeemed This Month

2. Main Chart — "Visits Over Time"
   - Line/area chart showing daily visits for the last 30 days
   - Smooth curve, branded color
   - Tooltip on hover with exact date + count
   - Toggle: 7d / 30d / 90d / 12m
   - Use Recharts

3. Secondary Charts Row:
   - "Busiest Days" — bar chart by day of week
   - "Reward Cycle Distribution" — donut chart showing how many
     customers are at each visit count (1/10, 2/10, etc.)

4. Recent Activity Feed:
   - Last 10 events (visits registered, rewards earned, rewards redeemed)
   - Relative timestamps (e.g., "2 minutes ago")
   - Customer name + action + staff member

5. Top Customers Card:
   - Top 5 most loyal customers with visit count
   - Small avatar/initials circle

Server components for data fetching. Use Suspense boundaries
with skeleton loaders for each section — no layout shift.

Create all data-fetching functions as server actions in /server/analytics.ts
with proper Prisma queries including date filtering and aggregation.
Where possible, read from AnalyticsSnapshot table for fast loading
and fall back to live queries for today's data.

Prisma v7 note: take advantage of the query caching layer — repeated
query shapes will be automatically cached for performance.
```

### Prompt 1.3 — Customer Management

```
Build the /dashboard/customers page — the core operational view.

1. Customer List with TanStack Table:
   - Columns: Name, Email/Phone, Visits (current cycle / total),
     Total Visits, Last Visit, Wallet Status, Actions
   - Server-side pagination (20 per page)
   - Column sorting (clickable headers)
   - Search bar: real-time search by name, email, phone (debounced, URL params)
   - Filter chips: Wallet Status (Apple/Google/None), Has Reward Available
   - Bulk actions: Export CSV

2. Add Customer Sheet (slide-over panel):
   - Form: Full Name*, Email, Phone
   - Validation with Zod + React Hook Form
   - Duplicate detection: warn if email or phone already exists
   - After creation, show QR code to add wallet pass

3. Customer Detail Sheet (click on row):
   - Header: Name, contact info, wallet status badge
   - Progress ring: visual circle showing currentCycleVisits / visitsRequired
   - Visit history timeline (scrollable)
   - Rewards history with status badges
   - Quick actions: Register Visit, Redeem Reward, Send Pass Update
   - Edit customer info
   - Delete with confirmation

4. Empty state: Friendly illustration + "Add your first customer" CTA

Every table interaction should feel instant. Use optimistic updates
for the "Register Visit" action — update UI immediately, then sync.

Use nuqs for URL-synced search params so the page state is shareable.

Next.js 16 note: searchParams are async — use `await props.searchParams`
in page components.

Auth note: the page Server Component calls getCurrentUser() from the DAL.
All server actions (addCustomer, registerVisit, etc.) also independently
call assertRestaurantAccess() — never trust that proxy.ts already checked.
```

---

## Phase 2 — Core Business Logic

### Prompt 2.1 — Visit Registration Flow

```
Build the visit registration system — the most-used feature.

This needs to feel FAST and SATISFYING for staff.

1. "Register Visit" Flow (3 ways to access):
   a. Quick action button in top bar → opens modal
   b. Command palette (Cmd+K) → "Register Visit"
   c. Customer detail panel → "Register Visit" button

2. Register Visit Modal/Sheet:
   - Large search input (auto-focused): search by name, email, or phone
   - Results appear as cards showing:
     Name, current progress (e.g., "7/10 visits"), last visit date
   - Click a customer → Confirm screen:
     - Customer name + photo/initials
     - Visual stamp card showing filled/empty circles
     - Big animated checkmark on confirm
     - If this visit triggers a reward: celebration animation
       (confetti or pulse) + "🎉 Reward Earned!" message
   - Confirmation closes after 2 seconds or on click

3. Server action: registerVisit(customerId)
   - Call assertRestaurantAccess() from DAL first
   - Validate: staff belongs to the same restaurant
   - Validate: prevent double-registration within 1 minute
   - Increment customer.currentCycleVisits and customer.totalVisits
   - Create Visit record with visitNumber = currentCycleVisits
     and loyaltyProgramId = active program's ID
   - If currentCycleVisits reaches program.visitsRequired:
     - Reset currentCycleVisits to 0
     - Create Reward record with AVAILABLE status and expiresAt calculated
       from program.rewardExpiryDays
     - Trigger wallet pass update job via Trigger.dev v4
   - Always: trigger wallet pass update with new visit count
   - Update customer.lastVisitAt
   - Return result with wasRewardEarned flag

4. Optimistic update:
   - Immediately update customer's visit count in any visible UI
   - Show toast via Sonner: "Visit registered for [Name]"
     or "Visit registered — Reward earned! 🎉"
   - Revalidate relevant paths

The confirm animation is key — staff doing this 100 times a day
should find it satisfying, not tedious.
```

### Prompt 2.2 — Reward Management

```
Build the reward tracking and redemption system.

1. /dashboard/rewards page:
   - Tabs: Available | Redeemed | Expired
   - Table: Customer Name, Reward, Earned Date, Status, Actions
   - "Redeem" button with confirmation for Available rewards
   - Search + date range filter

2. Redeem Reward Flow:
   - Can be triggered from rewards page or customer detail
   - Confirmation dialog showing:
     - Customer name
     - Reward description (e.g., "Free Burger")
     - Earned date
   - On confirm: update status to REDEEMED, set redeemedAt + redeemedById
   - Trigger wallet pass update via Trigger.dev v4
   - Success animation + toast

3. Server action: redeemReward(rewardId)
   - Call assertRestaurantAccess() from DAL
   - Validate status is AVAILABLE
   - Update record
   - Trigger pass update job
   - Return updated reward

4. Auto-expiry:
   - Create a Trigger.dev v4 scheduled task that runs daily
   - Expire rewards where expiresAt < now AND status = AVAILABLE
   - Update wallet pass when expired

5. Reward statistics:
   - Add to overview dashboard: redemption rate, avg time to earn reward
```

### Prompt 2.3 — Settings & Restaurant Configuration

```
Build the settings pages for restaurant owners.

/dashboard/settings with sub-navigation tabs:

Auth: All settings pages call assertRestaurantRole(restaurantId, "OWNER") from DAL.
Staff should get a 403 or redirect, not see the settings pages.

1. General Settings:
   - Restaurant name, address, phone, website, timezone
   - Logo upload (use Vercel Blob or S3-compatible storage like Cloudflare R2)
     Do NOT use local filesystem — Vercel deployments are ephemeral.
     Install @vercel/blob and use put() for uploads, del() for cleanup.
     Store the returned URL in restaurant.logo.
   - Brand colors (primary + secondary) with color picker
   - Preview of how the wallet pass will look with current branding
   - Save with optimistic update + toast

2. Loyalty Program Settings:
   - Visits required for reward (number input, min 3, max 30)
   - Reward description (text input)
   - Reward expiry days (number input, 0 = never)
   - Terms and conditions (textarea)
   - Toggle program active/inactive
   - Warning: "Changing visits required will affect customers
     currently in a cycle" with options (keep progress / reset all)

3. Team Management:
   - List of team members: name, email, role, status, last active
   - Invite team member: email + role (STAFF or OWNER)
     - Sends invitation email via Resend
   - Remove team member with confirmation
   - Pending invitations list with resend/cancel
   - Uses Better Auth's organization plugin to manage members

4. Billing (Stripe integration — Phase 4):
   - Current plan badge
   - Usage stats (customers, team members)
   - "Manage Subscription" button → Stripe Customer Portal
   - Placeholder for now, wire up in Phase 4

All forms use React Hook Form + Zod. Server actions for mutations.
Show unsaved changes indicator if user navigates away.
```

---

## Phase 3 — Wallet Pass Integration

### Prompt 3.1 — Apple Wallet Pass Generation

```
Implement Apple Wallet (PassKit) integration.

This is the most complex part. Take it step by step.

1. Install passkit-generator (npm package)

2. Create the pass template structure:
   /src/lib/wallet/apple/
   - pass-template/ (template directory with pass.json, icon files)
   - generate-pass.ts — main generation function
   - update-pass.ts — push update function
   - sign-pass.ts — signing utilities

3. Pass design (generic pass type):
   - Header: Restaurant logo (strip image)
   - Primary field: "[currentCycleVisits] / [visitsRequired] Visits"
   - Secondary fields: "Next Reward: [rewardDescription]"
   - Auxiliary field: "Member since [date]"
   - Back fields: Terms, restaurant contact info
   - Barcode: QR code encoding customer's walletPassId
   - Colors: pull from restaurant's brandColor settings
   - When reward is available: change header text to
     "🎉 Free [Reward] Available!" and optionally change color

4. API routes:
   - GET /api/wallet/apple/[serialNumber] — download .pkpass file
   - POST /api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]
     — device registration (save to DeviceRegistration model)
   - DELETE same path — device un-registration
   - GET /api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]
     — get serial numbers for device
   - GET /api/wallet/apple/v1/passes/[passTypeId]/[serialNumber]
     — get latest pass for serial number

   These are Apple's required callback URLs for wallet pass updates.

   Next.js 16 note: all route handler params are async.
   Use: const { serialNumber } = await params;

5. The DeviceRegistration model already exists in the schema (Phase 0.2).
   Use it to track which devices to push updates to.

6. Environment variables needed:
   - APPLE_PASS_TYPE_IDENTIFIER
   - APPLE_TEAM_IDENTIFIER
   - APPLE_PASS_CERTIFICATE (base64 encoded .pem)
   - APPLE_PASS_KEY (base64 encoded .key)
   - APPLE_WWDR_CERTIFICATE (base64 encoded)

Document clearly what certificates are needed and how to obtain them
from Apple Developer portal.
```

### Prompt 3.2 — Google Wallet Pass Generation

```
Implement Google Wallet integration.

1. Create:
   /src/lib/wallet/google/
   - generate-pass.ts
   - update-pass.ts
   - jwt-utils.ts

2. Google Wallet uses JWT-based passes (Generic Pass):
   - Create a loyalty class per restaurant
   - Create a loyalty object per customer
   - Generate a "Save to Google Wallet" link with signed JWT

3. Pass content:
   - Header: Restaurant name + logo
   - Hero image: Restaurant brand image (optional)
   - Primary info: currentCycleVisits / visitsRequired progress
   - Details: Reward info, member since
   - Barcode: QR code with walletPassId

4. API routes:
   - POST /api/wallet/google/save-url — generate save-to-wallet URL
   - Callback endpoint for wallet status updates

5. To update Google Wallet passes:
   - Use Google Wallet API to PATCH the loyalty object
   - This automatically updates on the user's phone

6. Environment variables:
   - GOOGLE_WALLET_ISSUER_ID
   - GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL
   - GOOGLE_WALLET_PRIVATE_KEY

Document the Google Cloud Console setup steps needed.
```

### Prompt 3.3 — QR Code & Onboarding Flow

```
Build the customer-facing wallet pass acquisition flow.

1. QR Code Generation:
   - Each restaurant gets a unique QR code URL:
     https://[domain]/join/[restaurant-slug]
   - Generate QR code as SVG (use qrcode library)
   - Downloadable/printable QR code page for the restaurant:
     /dashboard/settings/qr-code
     - Shows QR code with restaurant branding
     - "Download as PNG" and "Download as PDF" (for printing)
     - Size options: table tent, poster, receipt-size

2. Customer Onboarding Page — /join/[restaurant-slug]:
   - Detect device: iOS → Apple Wallet, Android → Google Wallet
   - Clean, mobile-first page:
     - Restaurant logo + name
     - "Get your digital loyalty card"
     - Brief explanation: "Earn a free [reward] after [N] visits"
     - Form: Name*, Email (optional), Phone (optional)
     - "Add to [Apple/Google] Wallet" button
   - On submit:
     - Create Customer record (with currentCycleVisits = 0)
     - Generate wallet pass
     - Apple: auto-download .pkpass file
     - Google: redirect to save-to-wallet URL

   Next.js 16 note: params are async.
   Use: const { slug } = await params;

3. NFC Support (optional/future):
   - Document how to program NFC tags with the join URL
   - Same flow — NFC tap opens /join/[slug] in browser

4. Already-a-member detection:
   - If email or phone matches existing customer
   - Show: "Welcome back! Tap to re-add your card"
   - Re-download latest pass instead of creating duplicate
```

### Prompt 3.4 — Trigger.dev Background Jobs

```
Set up Trigger.dev v4 jobs for all async processing.

IMPORTANT: This uses Trigger.dev v4 (GA), NOT v3.
Key v4 differences:
- Queues must be defined in code before deployment
- Warm machine reuse (100-300ms starts)
- New task/queue API syntax
- Use: pnpm add @trigger.dev/sdk@^4 trigger.dev@^4

1. Configure Trigger.dev v4:
   - Set up trigger.config.ts
   - Configure the project
   - Define all queues explicitly in code

2. Tasks to create:

   a. updateWalletPass — triggered after every visit/reward change
      - Input: customerId, updateType (VISIT | REWARD_EARNED |
        REWARD_REDEEMED | REWARD_EXPIRED)
      - Regenerate Apple pass with new data → push to registered devices
        (query DeviceRegistration model for push tokens)
      - Update Google pass object via API
      - Log result to WalletPassLog
      - Retry 3x with exponential backoff on failure

   b. sendRewardNotification — triggered when reward earned
      - Could send push notification via wallet pass update
      - Apple: pass update automatically shows notification
      - Google: pass update shows notification
      - Log the event

   c. expireRewards — scheduled CRON task (daily at 2am)
      - Find all AVAILABLE rewards where expiresAt < now
      - Update status to EXPIRED
      - Trigger wallet pass updates for each
      - Log batch results

   d. generateAnalyticsSnapshot — scheduled CRON (daily at 3am)
      - Compute daily aggregates per restaurant
      - Store in AnalyticsSnapshot model (already in schema)
      - Fields: totalCustomers, newCustomers, totalVisits,
        rewardsEarned, rewardsRedeemed for that day
      - Prevents expensive queries on dashboard page load

   e. processStripeWebhook — triggered from Stripe webhook handler
      - Handle subscription events
      - Update restaurant plan status and subscriptionStatus
      - Handle payment failures

   f. sendTrialReminderEmail — scheduled CRON (daily at 9am)
      - Find restaurants where trialEndsAt is 7, 3, or 1 days away
      - Send reminder email via Resend
      - Template in /emails/trial-reminder.tsx

   g. sendInvitationEmail — triggered when staff is invited
      - Send invitation email via Resend with the invite link
      - Template in /emails/invitation.tsx

   h. sendWelcomeEmail — triggered after restaurant registration completes
      - Send welcome email to new restaurant owner via Resend
      - Include: getting started tips, QR code link, support contact
      - Template in /emails/welcome.tsx

3. Define queues for each task category:
   - wallet-updates (concurrency: 10)
   - notifications (concurrency: 5)
   - analytics (concurrency: 2)
   - billing (concurrency: 3)
   - emails (concurrency: 5)

4. Create a /dashboard/settings/jobs page (OWNER only) showing
   recent job history and status for debugging.
```

---

## Phase 4 — Stripe Billing & Multi-Tenancy

### Prompt 4.1 — Stripe Subscription Billing

```
Implement Stripe subscription billing.
Use stripe@^20 (Node SDK) and @stripe/stripe-js@^8 (client).
Stripe API version: 2026-01-28.clover

1. Plans:

   FREE:
   - Up to 50 customers
   - 1 staff member
   - Basic analytics
   - Watermark on wallet pass: "Powered by [ProductName]"

   STARTER ($29/month):
   - Up to 500 customers
   - 3 staff members
   - Full analytics
   - Custom branding (no watermark)
   - Email support

   PRO ($79/month):
   - Unlimited customers
   - 10 staff members
   - Priority support
   - API access
   - Advanced analytics
   - Multi-location (coming soon)

   ENTERPRISE (custom):
   - Contact us button
   - Everything in Pro
   - Custom integrations
   - Dedicated support

2. Implementation:

   a. Create Stripe products and prices via a seed script
   b. /api/stripe/create-checkout — creates Stripe Checkout session
   c. /api/stripe/webhook — handles all Stripe events:
      - checkout.session.completed → activate subscription
      - customer.subscription.updated → plan changes
      - customer.subscription.deleted → downgrade to FREE
      - invoice.payment_failed → mark as PAST_DUE, show banner
      - customer.subscription.trial_will_end → send reminder
   d. /api/stripe/portal — creates Customer Portal session

3. Billing settings page (/dashboard/settings/billing):
   - Current plan with feature comparison
   - Usage meters (customers used / limit)
   - Upgrade/downgrade buttons → Stripe Checkout
   - "Manage Billing" → Stripe Customer Portal
   - Payment status banner if PAST_DUE
   - Trial banner showing days remaining if TRIALING

4. Plan enforcement:
   - Check plan limits before:
     - Creating customers (FREE: 50 limit)
     - Inviting staff (plan-specific limits)
   - Show upgrade prompt when limits approached (80% threshold)
   - Soft enforce: show warnings, not hard blocks (except at 100%)

5. Trial: 14-day trial of STARTER on signup.
   - Created automatically in the onboarding flow (see Phase 4.2)
   - Set restaurant.trialEndsAt and restaurant.subscriptionStatus = TRIALING
   - Trigger.dev sendTrialReminderEmail task handles reminders
```

### Prompt 4.2 — Onboarding Flow (Restaurant Registration)

```
Build the restaurant owner registration and onboarding flow.

1. Marketing landing page at / (public):
   - Hero: headline + "Start Free Trial" CTA
   - How it works: 3-step visual
   - Pricing table
   - Testimonials (placeholder)
   - FAQ accordion
   - Footer with links
   (Build this with polished, premium design — NOT generic template)

   Use React 19.2 View Transitions for smooth scroll animations.

2. Registration flow (/register):
   Step 1: Account — email, password, full name
     (uses Better Auth signUp via auth client)
   Step 2: Restaurant — name, address, phone
   Step 3: Branding — upload logo, pick brand colors
   Step 4: Loyalty Program — set visits required + reward
   Step 5: Stripe & Trial Setup (server action, no UI):
     - Create Stripe customer for the restaurant
     - Start 14-day STARTER trial subscription
     - Set restaurant.stripeCustomerId and trialEndsAt
     - Set subscriptionStatus = TRIALING
   Step 6: Done — show QR code, invite to print it, send welcome email

   Multi-step form with progress indicator.
   Each step is a server action that saves progress.
   Can resume if they leave mid-flow.
   Step 5 happens automatically between Step 4 and Step 6 (no user input).

3. Post-registration:
   - Redirect to dashboard
   - Show onboarding checklist widget:
     ☐ Upload your logo
     ☐ Customize your loyalty card
     ☐ Print your QR code
     ☐ Register your first customer
     ☐ Invite your staff
   - Dismissible, tracks completion in restaurant settings JSON
   - Trial banner: "14 days left on your free trial — Upgrade"

4. Welcome email:
   - Trigger sendWelcomeEmail task via Trigger.dev (defined in Phase 3.4)
   - Template in /emails/welcome.tsx via React Email + Resend
   - Include: getting started tips, QR code link, support contact

5. Create the demo restaurant seed that new users can browse
   before committing — "See it in action" on landing page.
```

---

## Phase 5 — Polish & Production Readiness

### Prompt 5.1 — Error Handling, Loading States & Edge Cases

```
Go through the ENTIRE application and add production-grade
error handling, loading states, and edge cases.

1. Error Handling:
   - Global error boundary with friendly error page
   - Per-page error.tsx files with contextual messages
   - Server action error handling: return typed errors, never throw
   - Form errors: inline field validation + summary
   - API route error responses: consistent JSON format
   - Toast notifications via Sonner for all async operations

2. Loading States:
   - Skeleton loaders for every data-fetching component
   - Button loading states (spinner + disabled) on all forms
   - Table loading: skeleton rows, not spinner
   - Page transitions: use React 19.2 View Transitions
   - Suspense boundaries at the right granularity
     (section-level, not page-level)

3. Empty States:
   - Every list/table needs an empty state with:
     - Contextual illustration or icon
     - Helpful message
     - Primary CTA (e.g., "Add your first customer")
   - Dashboard overview with no data: onboarding-focused

4. Edge Cases:
   - Concurrent visit registration (race condition protection)
   - Offline handling: show banner, queue actions
   - Session expiry: DAL throws, catch in Server Component, redirect to login
   - Plan limit reached: upgrade prompts, not broken UI
   - Deleted customer with active wallet pass
   - Restaurant with no active loyalty program
   - Trial expired but user hasn't upgraded: show upgrade gate

5. Accessibility:
   - Keyboard navigation for all interactive elements
   - Focus management in modals and sheets
   - ARIA labels on icon buttons
   - Color contrast compliance (WCAG AA)
   - Screen reader testing for main flows
```

### Prompt 5.2 — Responsive Design & Mobile Optimization

```
Ensure the entire dashboard works flawlessly on mobile.

Restaurant staff will use this on phones and tablets during service.

1. Mobile Dashboard:
   - Bottom tab navigation (Overview, Customers, Visit+, Rewards, More)
   - "Register Visit" (Visit+) is center tab with prominent FAB-style button
     This is a quick action that opens the register visit modal, not a page
   - Cards stack vertically
   - Charts resize properly
   - Tables become card lists on mobile

2. Register Visit (Mobile):
   - This is THE critical mobile flow
   - Full-screen search → one-tap confirm
   - Large touch targets (min 44px)
   - Haptic feedback on confirm (if supported)
   - Should take < 5 seconds from open to confirmed

3. Customer Detail (Mobile):
   - Full-screen sheet sliding up
   - Swipeable between customers
   - Large visit count display
   - Quick action buttons in easy thumb reach

4. Test at breakpoints:
   - 375px (iPhone SE)
   - 390px (iPhone 16)
   - 768px (iPad)
   - 1024px (iPad landscape)
   - 1440px (Desktop)

5. PWA Configuration:
   - Add manifest.json
   - Service worker for basic caching
   - "Add to Home Screen" prompt for restaurant staff
   - Splash screen with restaurant branding
```

### Prompt 5.3 — Security Hardening

```
Security audit and hardening pass.

1. Authentication (Better Auth handles most of this, but verify):
   - Rate limit login attempts
   - CSRF protection on all mutations
   - Secure session configuration
   - Password requirements: min 8 chars, entropy check
   - Account lockout after 10 failed attempts
   - Better Auth's built-in protections are active

2. Authorization — verify the DAL pattern is enforced:
   - Every Server Component: calls getCurrentUser() from DAL
   - Every server action: calls assertRestaurantAccess() from DAL
   - Every API route: validates session + permissions via DAL
   - Never expose other restaurants' data
   - Staff cannot access billing/team settings (assertRestaurantRole(id, "OWNER"))
   - proxy.ts does NOT do any authorization — only optimistic redirects
   - Audit: grep for any server action that doesn't call DAL first

3. Input Validation:
   - Zod schemas on every form input AND server action
   - Sanitize all text inputs
   - File upload validation (logo): type, size, dimensions

4. API Security:
   - Wallet pass API endpoints: validate against serial number ownership
   - Stripe webhooks: verify signature with stripe@^20 constructEvent
   - Rate limiting on public endpoints (/join/[slug], /api/wallet/*)
   - CORS configuration

5. Data Protection:
   - No PII in logs
   - Encrypt sensitive fields (Stripe keys in env only)
   - Soft delete for customers (GDPR consideration)
   - Data export endpoint for restaurant owners (GDPR)

6. Infrastructure:
   - Security headers in next.config.ts headers configuration
     (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
     Do NOT put static security headers in proxy.ts — use next.config.ts
   - Environment variable validation on startup with Zod
   - Prisma query protection (no raw SQL, parameterized)

7. Next.js 16 specific security:
   - Ensure proxy.ts only does cookie checks (no heavy logic)
   - Verify the DAL is the real security boundary
   - Check for React Server Component vulnerabilities
   - Keep Next.js updated (recent CVEs: CVE-2025-66478,
     CVE-2025-55184, CVE-2025-55183 — ensure patched version)
```

### Prompt 5.4 — Testing

```
Add tests for critical business logic.

1. Unit Tests (Vitest):
   - Visit registration logic (cycle counting, reward triggering,
     currentCycleVisits reset)
   - Reward expiry logic
   - Plan limit enforcement
   - QR code URL generation
   - Wallet pass data formatting
   - DAL authorization helpers (assertRestaurantAccess, assertRestaurantRole)

2. Integration Tests:
   - Register visit → currentCycleVisits increment → reward creation flow
   - Customer creation → wallet pass generation
   - Stripe webhook → plan update → subscriptionStatus change
   - Full onboarding flow data persistence including Stripe trial
   - Better Auth sign-up/sign-in flows
   - DAL correctly rejects cross-restaurant access

3. E2E Tests (Playwright):
   - Owner registration → onboarding → first customer → first visit
   - Staff login → register visit → redeem reward
   - Customer: scan QR → add wallet pass
   - Billing: upgrade plan flow
   - Staff cannot access settings pages (authorization)

4. Test configuration:
   - Set up Vitest with path aliases matching the app
   - Prisma v7 test utilities with database cleanup
   - Mock Stripe for webhook tests
   - Mock Resend for email tests
   - Test database seeding

Focus on the critical paths. Don't aim for 100% coverage —
cover the flows that would lose money if they broke.
```

### Prompt 5.5 — Performance & SEO

```
Optimize performance and SEO.

1. Performance:
   - Analyze bundle size, code-split large components
   - Optimize images: next/image with proper sizes
   - Database: add missing indexes based on slow query log
   - Use Next.js 16 Cache Components (`use cache`) for dashboard data
     that isn't user-specific (e.g., restaurant config, loyalty program)
   - Read from AnalyticsSnapshot for dashboard stats (avoid heavy queries)
   - Prefetch critical data on hover (router.prefetch)
   - Debounce search inputs (300ms)
   - Prisma v7 query caching is automatic for repeated query shapes

2. SEO (public pages only):
   - Metadata on all public pages
   - Open Graph images (auto-generated)
   - Sitemap.xml
   - Robots.txt
   - JSON-LD structured data for the marketing site
   - Canonical URLs

3. Analytics:
   - Add PostHog or Plausible for product analytics
   - Track: signups, QR scans, visit registrations, reward redemptions
   - Funnel: QR scan → wallet add → first visit → reward earned

4. Monitoring:
   - Error tracking (Sentry)
   - Uptime monitoring on critical endpoints
   - Stripe webhook failure alerts
   - Wallet pass update failure alerts via Trigger.dev v4 observability
   - Resend email delivery monitoring
```

---

## Phase 6 — Deployment

### Prompt 6.1 — Production Deployment

```
Prepare and deploy to production.

1. Vercel Deployment:
   - Verify next.config.ts has cacheComponents: true
   - Environment variables in Vercel dashboard
   - Preview deployments for PRs
   - Production domain setup

2. Database:
   - Neon or Supabase PostgreSQL (PostgreSQL 17+, ideally 18)
   - Connection pooling configured
   - Database backup schedule
   - Migration deployment strategy
   - Prisma v7 with connection pooling via Prisma Accelerate
     or Neon's built-in pooler

3. Trigger.dev v4:
   - Deploy trigger tasks: npx trigger.dev@latest deploy
   - Configure production environment
   - Set up cron schedules (expireRewards, generateAnalyticsSnapshot,
     sendTrialReminderEmail)
   - Define queues with appropriate concurrency limits

4. Resend:
   - Configure production sending domain
   - Verify DNS records (SPF, DKIM, DMARC)
   - Set up email delivery webhooks for bounce handling

5. DNS & Domain:
   - Custom domain
   - SSL certificate (auto via Vercel)
   - Email domain for transactional emails

6. Pre-launch Checklist:
   - [ ] All environment variables set
   - [ ] Database migrations applied (npx prisma migrate deploy)
   - [ ] Stripe webhooks pointed to production
   - [ ] Apple/Google wallet certificates configured
   - [ ] Better Auth configured with production URLs and trustedOrigins
   - [ ] Resend production domain verified
   - [ ] Error tracking active (Sentry)
   - [ ] Backup verified
   - [ ] Rate limiting tested
   - [ ] Load test critical endpoints
   - [ ] GDPR compliance reviewed
   - [ ] Terms of service and privacy policy pages
   - [ ] Next.js 16 security patches applied (check CVEs)
   - [ ] DAL authorization verified (no server action without auth check)
   - [ ] proxy.ts only does optimistic cookie checks
   - [ ] Security headers configured in next.config.ts
   - [ ] Trial flow tested end-to-end (signup → trial → expiry → upgrade)
```

---

## Claude Code Tips for This Project

### How to Use These Prompts

1. **One phase at a time.** Don't dump everything at once.
2. **Review after each prompt.** Test the output before moving on.
3. **Feed context.** When starting a new session, tell Claude Code:
   *"Read the current codebase structure and continue from Phase X."*
4. **Provide docs for wallet integration.** Copy Apple PassKit and Google Wallet
   API documentation into the context when working on Phase 3.
5. **Provide Better Auth docs.** When working on Phase 0.3, feed Claude Code
   the Better Auth docs: https://www.better-auth.com/docs
6. **Iterate on UX.** After Phase 1, open the app in a browser and
   give Claude Code visual feedback: *"The sidebar feels cramped — increase
   padding and make the active state more prominent."*
7. **Verify the DAL pattern.** After each phase, check that no server action
   or Server Component accesses data without calling the DAL first.

### Context Management

Claude Code works best with focused context. For each session:
- Specify which files are relevant
- Reference the schema when working on business logic
- Share error messages verbatim when debugging
- For Prisma v7, always reference prisma.config.ts and schema.prisma together
- For auth issues, reference /src/lib/auth.ts, /src/lib/dal.ts, and proxy.ts

### Quality Checkpoints

After each phase, verify:
- [ ] TypeScript: no `any` types, strict mode passes
- [ ] Every form validates on client AND server
- [ ] Every server action calls DAL authorization first (assertRestaurantAccess or assertRestaurantRole)
- [ ] Every Server Component calls getCurrentUser() from DAL
- [ ] User.role is only USER or SUPER_ADMIN — restaurant roles are in org membership
- [ ] proxy.ts only reads cookies — no DB calls, no role checks
- [ ] Mobile responsive (test at 375px)
- [ ] Loading and error states exist for all async operations
- [ ] No console errors or warnings
- [ ] Better Auth session works in Server Components and Client Components

---

## Estimated Timeline

| Phase | Effort | Solo Dev + Claude Code |
|-------|--------|----------------------|
| Phase 0 — Foundation | Medium | 2-3 days |
| Phase 1 — Dashboard UX | Medium | 2-3 days |
| Phase 2 — Business Logic | Medium | 2-3 days |
| Phase 3 — Wallet Passes | High | 4-6 days |
| Phase 4 — Billing & Onboarding | Medium | 2-3 days |
| Phase 5 — Polish & Hardening | High | 4-5 days |
| Phase 6 — Deployment | Low | 1-2 days |
| **Total** | | **~3-4 weeks** |

Phase 3 (wallet integration) is the wildcard. Budget extra time for
Apple certificate setup and testing on real devices.

---

## v4 Changelog — All Issues Fixed

### v3 fixes (issues 1–13)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | 🔴 Critical | proxy.ts misused as full auth guard | Added DAL pattern as real security boundary; proxy.ts only does cookie checks |
| 2 | 🔴 Critical | DeviceRegistration model missing from schema | Added as model #12 in Phase 0.2 |
| 3 | 🔴 Critical | AnalyticsSnapshot model missing from schema | Added as model #13 in Phase 0.2 |
| 4 | 🟡 Moderate | Better Auth User model conflicts with custom fields | Specified additionalFields pattern; Better Auth schema documented |
| 5 | 🟡 Moderate | Organization plugin vs custom role — undecided | Decided: use organization plugin; restaurants = organizations |
| 6 | 🟡 Moderate | Vite plugin mentioned but Next.js uses Turbopack | Removed Vite plugin; specified @tailwindcss/postcss only |
| 7 | 🟡 Moderate | cacheComponents: true not specified in config | Added explicit instruction to enable in next.config.ts |
| 8 | 🟡 Moderate | Trial/Stripe gap in onboarding flow | Added Step 5 to onboarding: auto-create Stripe customer + trial |
| 9 | 🟢 Minor | No currentCycleVisits field on Customer | Added field; updated all visit logic references |
| 10 | 🟢 Minor | Visit model missing loyaltyProgramId | Added loyaltyProgramId to Visit model |
| 11 | 🟢 Minor | uuidv7() guidance vague | Made explicit: use @default(dbgenerated("uuidv7()")) |
| 12 | 🟢 Minor | Security headers in proxy.ts (wrong place) | Moved to next.config.ts headers configuration |
| 13 | 🟢 Minor | No email service specified | Added Resend throughout: setup, templates, Trigger.dev email tasks |

### v4 fixes (issues 14–19)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 14 | 🟡 Moderate | Organization plugin schema tables missing from Phase 0.2 | Added explicit instructions: run `npx @better-auth/cli generate` for org tables; renamed Invitation → StaffInvitation to avoid table name conflict |
| 15 | 🟡 Moderate | Dual role system ambiguity (User.role vs org membership role) | Clear decision: User.role = USER or SUPER_ADMIN only (global). Restaurant-level OWNER/STAFF = org membership roles. DAL functions updated: assertRestaurantAccess + assertRestaurantRole. Role check cheat sheet added. |
| 16 | 🟢 Minor | sendWelcomeEmail task referenced in Phase 4.2 but never defined in Phase 3.4 | Added task (h) sendWelcomeEmail to Trigger.dev jobs |
| 17 | 🟢 Minor | /dashboard/visits nav item listed but page never built | Removed Visits from sidebar nav; clarified visits are registered via quick action/command palette/customer detail only |
| 18 | 🟢 Minor | Nullable unique constraints on Customer could cause confusion | Added NOTE clarifying PostgreSQL NULL behavior in unique indexes — default is correct, no partial index needed |
| 19 | 🟢 Minor | Logo upload uses local filesystem but Vercel is ephemeral | Replaced with Vercel Blob (@vercel/blob); added to stack, install list, and env vars |

---

*This plan is designed to be executed sequentially. Each phase builds
on the previous one. Skip nothing — the polish is what separates a
side project from a product people pay for.*
