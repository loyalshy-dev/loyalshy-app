# Conversation Guide — Fidelio Development

## Why Separate Conversations?

The full plan (~1,450 lines) + generated code will exceed context limits fast.
Each sub-prompt generates 500-2,000 lines of code. A single conversation can
handle 1-2 sub-prompts before quality degrades.

## Recommended Conversation Groupings

Some sub-prompts can be combined if they're tightly coupled:

| Conversation | Phases | Why |
|---|---|---|
| Conv 1 | **0.1** (Init + deps + folders) | Heavy install/restructure work |
| Conv 2 | **0.2** (DB Schema) | Prisma schema is self-contained |
| Conv 3 | **0.3** (Auth) | Auth touches many files, needs focused attention |
| Conv 4 | **1.1** (Dashboard Shell) | Layout + sidebar + command palette |
| Conv 5 | **1.2** (Overview Dashboard) | Charts + stats + data fetching |
| Conv 6 | **1.3** (Customer Management) | Table + CRUD + search |
| Conv 7 | **2.1 + 2.2** (Visits + Rewards) | Tightly coupled business logic |
| Conv 8 | **2.3** (Settings) | Forms + file upload + team mgmt |
| Conv 9 | **3.1** (Apple Wallet) | Complex, needs focused context |
| Conv 10 | **3.2** (Google Wallet) | Similar to Apple but different API |
| Conv 11 | **3.3 + 3.4** (QR/Onboarding + Trigger.dev) | Customer-facing + background jobs |
| Conv 12 | **4.1 + 4.2** (Stripe + Onboarding) | Billing is tightly coupled to onboarding |
| Conv 13 | **5.1 + 5.2** (Error handling + Mobile) | Polish pass across the app |
| Conv 14 | **5.3 + 5.4** (Security + Testing) | Security audit + test coverage |
| Conv 15 | **5.5 + 6.1** (Performance + Deployment) | Final optimization + deploy |

**Total: ~15 conversations over ~3-4 weeks**

## Starter Prompts for Each Conversation

### Conv 1 — Phase 0.1 (Project Init)
```
Read CLAUDE.md. Execute Phase 0.1 from loyalty-card-plan-v4.md.

The project already has Next.js 16.1.6, React 19.2.3, Tailwind v4, and shadcn/ui
installed at root level. You need to:
1. Restructure to use /src directory (move app/, components/, lib/ into src/)
2. Update tsconfig paths from @/* → ./src/*
3. Update components.json aliases
4. Install all remaining dependencies (Prisma, Better Auth, Stripe, Trigger.dev, etc.)
5. Create full folder structure under /src
6. Configure next.config.ts (cacheComponents, reactCompiler)
7. Create .env.example

Do NOT reinstall what's already there. Build on the existing setup.
```

### Conv 2 — Phase 0.2 (Database Schema)
```
Read CLAUDE.md. Execute Phase 0.2 from loyalty-card-plan-v4.md.

Create the Prisma schema with all 13 models. Key points:
- Use prisma.config.ts (Prisma v7)
- uuidv7() for all PKs
- Better Auth tables (User, Session, Account, Verification) must match their schema exactly
- Custom fields on User via additionalFields (role: USER/SUPER_ADMIN, restaurantId)
- StaffInvitation (not Invitation) to avoid Better Auth org plugin conflict
- After schema, run: npx @better-auth/cli generate for org plugin tables
- Create seed file with demo restaurant

Reference the plan for exact model definitions.
```

### Conv 3 — Phase 0.3 (Auth Configuration)
```
Read CLAUDE.md. Execute Phase 0.3 from loyalty-card-plan-v4.md.

Set up Better Auth with:
1. Auth config (src/lib/auth.ts) — email/password + Google OAuth + org plugin
2. Auth client (src/lib/auth-client.ts) — React hooks
3. API route handler (src/app/api/auth/[...all]/route.ts)
4. DAL (src/lib/dal.ts) — getCurrentUser, assertRestaurantAccess, assertRestaurantRole
5. proxy.ts — optimistic cookie redirect ONLY
6. Auth pages: /login, /register, /forgot-password
7. Invitation flow: /invite/[token]

THE DAL IS THE REAL SECURITY BOUNDARY. proxy.ts is just UX.
Read Better Auth docs if needed: https://www.better-auth.com/docs
```

### Conv 4-6 — Phase 1 (Dashboard)
```
Read CLAUDE.md. Execute Phase 1.[N] from loyalty-card-plan-v4.md.
Check the existing src/ structure first. Build on what exists.
Design direction: Linear/Vercel aesthetic, not generic shadcn defaults.
```

### Conv 7+ — Phase 2+ (Feature Work)
```
Read CLAUDE.md. Execute Phase [4.1] from loyalty-card-plan-v4.md.
Read the relevant existing files first. Check current progress in CLAUDE.md.
```

## After Each Conversation

Tell Claude:
```
Update CLAUDE.md to mark Phase [X.Y] as complete.
Note any issues or deviations from the plan.
```
