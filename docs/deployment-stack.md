# Loyalshy — Deployment Stack Guide

## Overview

This document outlines the recommended production infrastructure for deploying Loyalshy on Vercel.

## Infrastructure Map

| Layer | Service | Plan | Why |
|-------|---------|------|-----|
| **Compute** | Vercel | Pro ($20/mo) | Next.js 16 native support, Edge/Serverless, preview deploys |
| **Database** | Neon PostgreSQL | Launch ($19/mo) | Serverless Postgres, connection pooling, Vercel integration |
| **Cache / Rate Limiting** | Upstash Redis | Pay-as-you-go | HTTP-based (serverless-safe), rate limiting, no connection overhead |
| **File Storage** | Cloudflare R2 | Free tier (10GB) | Already configured — logos, strip images, stamp icons |
| **Background Jobs** | Trigger.dev | Hobby/Pro | Already configured — 8 tasks, 5 queues |
| **Email** | Resend | Free (100/day) → Pro | Already configured — transactional email via Trigger.dev |
| **Payments** | Stripe | Standard (2.9% + 30¢) | Already configured — subscriptions, checkout, webhooks |
| **Error Tracking** | Sentry | Developer (free) | Already configured — source maps, request instrumentation |
| **Analytics** | Plausible | Growth ($9/mo) | Already configured — privacy-first, no cookie banner |
| **DNS / CDN** | Cloudflare | Free | Fast DNS, DDoS protection, pairs with R2 |
| **Domain** | Any registrar | — | Point nameservers to Cloudflare |

## Database: Neon PostgreSQL

### Why Neon

- **Serverless** — scales to zero, no idle costs on dev/preview branches
- **Connection pooling** built-in (critical for Vercel serverless functions)
- **Branching** — instant DB branches for Vercel preview deployments
- **PostgreSQL 18** compatible — supports `uuidv7()` via `pg_uuidv7` extension
- **Vercel integration** — auto-injects `DATABASE_URL` into env vars
- **Prisma-optimized** — documented connection string format for Prisma

### Setup

1. Create a Neon project at [neon.tech](https://neon.tech)
2. Install the Vercel integration → auto-provisions `DATABASE_URL` and `DATABASE_URL_UNPOOLED`
3. Enable the `pg_uuidv7` extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_uuidv7;
   ```
4. Update `prisma.config.ts` to use `DATABASE_URL` (pooled) for queries and `DATABASE_URL_UNPOOLED` for migrations:
   ```ts
   // prisma.config.ts
   import path from "node:path";
   import type { PrismaConfig } from "prisma";

   export default {
     earlyAccess: true,
     schema: path.join("prisma", "schema.prisma"),
     migrate: {
       async url() {
         return process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!;
       },
     },
     studio: {
       async url() {
         return process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!;
       },
     },
   } satisfies PrismaConfig;
   ```
5. Run migrations: `npx prisma migrate deploy`

### Connection String Format

```
# Pooled (for app queries)
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/loyalshy?sslmode=require&pgbouncer=true"

# Direct (for migrations)
DATABASE_URL_UNPOOLED="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/loyalshy?sslmode=require"
```

### Alternatives Considered

| Provider | Pros | Cons |
|----------|------|------|
| **Supabase** | Generous free tier, built-in auth (unused) | Dedicated instance, no scale-to-zero, heavier |
| **Vercel Postgres** | Tightest integration | More expensive, less control (Neon under the hood) |
| **Railway** | Simple, fixed pricing | No serverless scaling, no branching |
| **PlanetScale** | MySQL only | Incompatible — project uses PostgreSQL |

## Cache / Rate Limiting: Upstash Redis

### Why Upstash

- **HTTP-based** — no persistent connections, works perfectly in Vercel serverless
- **Serverless pricing** — pay per request, no idle costs
- **Vercel integration** — auto-injects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- **@upstash/ratelimit** — drop-in rate limiting library (already using rate limiting in Phase 5.3)
- **Global replication** — optional multi-region for low-latency reads

### Use Cases

- **Rate limiting** — API routes, auth endpoints, server actions (replace in-memory rate limiter)
- **Session cache** — optional, if Better Auth session lookups become a bottleneck
- **Idempotency keys** — Stripe webhook deduplication (currently in-memory)

### Setup

1. Create an Upstash Redis database at [upstash.com](https://upstash.com)
2. Install the Vercel integration → auto-provisions env vars
3. Install the SDK:
   ```bash
   pnpm add @upstash/redis @upstash/ratelimit
   ```
4. Create a Redis client:
   ```ts
   // src/lib/redis.ts
   import { Redis } from "@upstash/redis";

   export const redis = new Redis({
     url: process.env.UPSTASH_REDIS_REST_URL!,
     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
   });
   ```
5. Update rate limiter to use Redis-backed store instead of in-memory Map

### Alternatives Considered

| Provider | Pros | Cons |
|----------|------|------|
| **Vercel KV** | Tightest integration | More expensive (Upstash under the hood) |
| **Redis Cloud** | Full Redis feature set | TCP connections, not serverless-friendly |
| **Momento** | Serverless | Smaller ecosystem, less Vercel tooling |

## Vercel Configuration

### Build Settings

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Build Command | `pnpm build` |
| Output Directory | `.next` |
| Install Command | `pnpm install` |
| Node.js Version | 22.x |

### Environment Variables

All env vars from `.env.example` must be set in Vercel project settings. Organized by service:

**Auto-injected by integrations:**
- `DATABASE_URL` — Neon (pooled)
- `DATABASE_URL_UNPOOLED` — Neon (direct)
- `UPSTASH_REDIS_REST_URL` — Upstash
- `UPSTASH_REDIS_REST_TOKEN` — Upstash

**Must set manually:**
- `BETTER_AUTH_SECRET` — generate with `openssl rand -base64 32`
- `BETTER_AUTH_URL` — `https://yourdomain.com`
- `NEXT_PUBLIC_BETTER_AUTH_URL` — `https://yourdomain.com`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET` — from Stripe webhook endpoint config
- `TRIGGER_SECRET_KEY` — from Trigger.dev dashboard
- `RESEND_API_KEY` — from Resend dashboard
- `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL`
- `APPLE_PASS_TYPE_IDENTIFIER` / `APPLE_TEAM_IDENTIFIER` / `APPLE_PASS_CERTIFICATE` / `APPLE_PASS_KEY` / `APPLE_PASS_KEY_PASSPHRASE` / `APPLE_WWDR_CERTIFICATE`
- `GOOGLE_WALLET_ISSUER_ID` / `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY`
- `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` / `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` — your production domain

### Vercel Integrations to Install

1. **Neon** — [vercel.com/integrations/neon](https://vercel.com/integrations/neon)
2. **Upstash** — [vercel.com/integrations/upstash](https://vercel.com/integrations/upstash)
3. **Sentry** — [vercel.com/integrations/sentry](https://vercel.com/integrations/sentry)

### Preview Deployments

- Neon auto-creates a **database branch** per preview deployment (if enabled)
- Set `BETTER_AUTH_URL` per environment (preview vs production)
- Stripe test keys for preview, live keys for production

## Deployment Checklist

### Pre-Deploy

- [ ] All env vars set in Vercel project settings
- [ ] Neon database created with `pg_uuidv7` extension enabled
- [ ] Upstash Redis created
- [ ] Stripe webhook endpoint configured for production URL
- [ ] Apple Wallet certificates uploaded as base64 env vars
- [ ] Google Wallet service account key set
- [ ] R2 bucket CORS configured for production domain
- [ ] Sentry project created, auth token generated
- [ ] Custom domain added to Vercel + Cloudflare DNS
- [ ] Plausible site created for production domain

### Post-Deploy

- [ ] Run `prisma migrate deploy` against production DB
- [ ] Seed initial data if needed (`prisma db seed`)
- [ ] Verify Stripe webhook receives events
- [ ] Test Apple/Google Wallet pass generation
- [ ] Test QR code onboarding flow end-to-end
- [ ] Verify Trigger.dev tasks are running
- [ ] Check Sentry error tracking is active
- [ ] Verify rate limiting works (Redis-backed)
- [ ] Test email delivery via Resend
- [ ] Monitor Vercel function logs for first 24h

## Cost Estimate (Monthly)

| Service | Tier | Est. Cost |
|---------|------|-----------|
| Vercel | Pro | $20 |
| Neon | Launch | $19 |
| Upstash Redis | Pay-as-you-go | $0–5 |
| Cloudflare R2 | Free tier | $0 |
| Trigger.dev | Hobby | $0 |
| Resend | Free (100/day) | $0 |
| Sentry | Developer | $0 |
| Plausible | Growth | $9 |
| Stripe | Per transaction | 2.9% + 30¢ |
| Cloudflare DNS | Free | $0 |
| **Total (fixed)** | | **~$48–53/mo** |

Scales well — Neon and Upstash are usage-based, so costs grow with traffic rather than upfront.
