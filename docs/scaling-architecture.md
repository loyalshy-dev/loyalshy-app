# Scaling Architecture — Loyalshy

Infrastructure scaling roadmap based on organization count growth thresholds.

## Current Stack (2026)

| Layer | Service | Plan | Limit |
|-------|---------|------|-------|
| Compute | Vercel | Pro | 1,000 concurrent functions, 60s timeout |
| Database | Neon PostgreSQL | Serverless | Connection pooling, autoscaling compute |
| Cache / Rate Limiting | Upstash Redis | Pay-as-you-go | HTTP-based, no connection limits |
| Background Jobs | Trigger.dev | v4 GA | Warm machine reuse, 5 queues |
| File Storage | Cloudflare R2 | Free/paid | S3-compatible, no egress fees |
| Email | Resend | Free/Pro | Transactional via Trigger.dev |
| Payments | Stripe | Standard | No infrastructure concern |
| Error Tracking | Sentry | Free | 5k events/mo |
| Analytics | Plausible | Script-based | Privacy-first, no infra load |
| API Docs | Scalar | Static | Served from Vercel |

## Traffic Assumptions

SaaS orgs follow predictable concurrency patterns:

- **5-10%** of orgs are active simultaneously during peak hours
- **~20%** of orgs use the REST API
- Public card pages are spiky but highly cacheable
- Wallet pass generation is CPU-intensive (Apple `.pkpass` + Google JWT signing)

| Orgs | Peak dashboard sessions | API req/min (peak) | Public page hits/hr |
|------|------------------------|--------------------|---------------------|
| 500 | 25-50 | ~200 | ~500 |
| 3,000 | 150-300 | ~1,200 | ~3,000 |
| 10,000 | 500-1,000 | ~4,000 | ~10,000 |
| 50,000 | 2,500-5,000 | ~20,000 | ~50,000 |

## Cost vs Revenue Projections

Assuming distribution: 50% Free, 30% Pro (€29), 15% Business (€49), 5% Scale (€99).

| Orgs | Monthly Revenue | Infra Cost | Margin |
|------|----------------|------------|--------|
| 500 | ~€10,500 | ~€50-160 | ~98% |
| 3,000 | ~€63,000 | ~€300-500 | ~99% |
| 10,000 | ~€210,000 | ~€1,000-2,000 | ~99% |
| 50,000 | ~€1,050,000 | ~€5,000-10,000 | ~99% |

---

## Tier 1: 0–3,000 Orgs — No Changes Required

The current stack handles this range comfortably with zero architecture changes.

### What works as-is

- Vercel serverless auto-scales to handle 150-300 concurrent dashboard sessions
- Neon PostgreSQL connection pooling handles the query volume
- Upstash Redis rate limiting and idempotency work at this scale
- Trigger.dev processes wallet generation and webhook delivery without backlog
- R2 storage is negligible (logos, strip images, pass files)

### Monitoring to set up

- Neon dashboard: connection count, query latency p95, compute utilization
- Vercel analytics: function duration, cold start frequency, error rate
- Upstash: command count, latency
- Set alerts for: DB connection count > 80% pool, function duration > 10s, error rate > 1%

### Estimated infrastructure cost

| Service | Plan | Monthly |
|---------|------|---------|
| Vercel Pro | Current | $20 |
| Neon Postgres | Launch | $19 |
| Upstash Redis | Pay-as-you-go | $5-15 |
| Trigger.dev | Hobby/Pro | $0-29 |
| Resend | Free/Pro | $0-20 |
| Cloudflare R2 | Free tier | $0-5 |
| **Total** | | **$50-160** |

---

## Tier 2: 3,000–10,000 Orgs — Optimize

First signs of pressure appear. Targeted optimizations, no re-architecture.

### Bottlenecks

1. **Database read load** — Dashboard pages hit the DB on every request (org stats, contact lists, pass instances). 300 concurrent sessions means 300+ queries/second.
2. **Wallet pass generation** — CPU-intensive `passkit-generator` work in serverless functions approaches timeout limits under burst.
3. **Cold starts** — More function instances = more cold starts during traffic spikes.

### Changes

#### 1. Read replicas (Neon)

Route all read-heavy dashboard queries through a Neon read replica. Neon supports this natively.

```
Primary (write) ← Server actions, API mutations
Read replica     ← Dashboard pages, stats, contact lists, API reads
```

**Effort**: ~2-3 days. Update `db.ts` to expose a read-only client, update DAL read functions.

#### 2. Aggressive caching with `"use cache"`

Add caching to high-traffic, low-change-frequency data:

- Program lists and stats (revalidate on mutation)
- Organization settings and branding
- Contact counts and analytics snapshots
- Public card page data (per-pass, long TTL)

**Effort**: ~3-5 days. Add `"use cache"` directives and revalidation calls in server actions.

#### 3. Dedicated wallet generation workers

Move `passkit-generator` (Apple) and Google JWT signing out of Vercel serverless into Trigger.dev dedicated machines with more CPU/memory.

Currently wallet generation happens inline during pass creation. Change to:
1. API/action creates PassInstance record
2. Trigger.dev task generates wallet files asynchronously
3. Wallet URLs resolve once generation completes

**Effort**: ~1 week. Refactor wallet generation into async Trigger.dev tasks.

#### 4. CDN caching for public pages

Public card pages (`/join/[slug]/card/[passInstanceId]`) are per-pass and change infrequently. Add cache headers or use Vercel ISR with on-demand revalidation when a pass is updated.

**Effort**: ~1-2 days.

### Estimated infrastructure cost

| Service | Plan | Monthly |
|---------|------|---------|
| Vercel Pro | Current | $20 |
| Neon Postgres | Scale (read replicas) | $69-200 |
| Upstash Redis | Pro | $30-50 |
| Trigger.dev | Pro (dedicated machines) | $50-100 |
| Resend | Pro | $20-50 |
| Cloudflare R2 | Paid | $5-20 |
| **Total** | | **$300-500** |

---

## Tier 3: 10,000–50,000 Orgs — Selective Re-architecture

Multiple components need structural changes. Still Next.js on Vercel, but with extracted services.

### Bottlenecks

1. **Single Postgres instance** — Even with read replicas, write volume from interactions (stamps, scans, check-ins) saturates the primary.
2. **Single-region latency** — If orgs are global, users far from the Vercel region experience 200ms+ latency.
3. **Serverless function limits** — 1,000 concurrent executions starts to feel tight during peak hours.
4. **Redis single-region** — Rate limit checks add latency for distant users.

### Changes

#### 1. Table partitioning by organization

Partition the largest tables by `organizationId`:

- `Interaction` — highest write volume (stamps, scans, check-ins)
- `PassInstance` — grows linearly with contacts × templates
- `WalletPassLog` — append-only log
- `ApiRequestLog` — high volume if API adoption grows

Postgres native partitioning handles this. Prisma 7 supports partitioned tables.

**Effort**: ~2-3 weeks. Schema migration, query updates, backfill.

#### 2. Multi-region database

Deploy Neon read replicas (or move to CockroachDB/PlanetScale) in multiple regions:

```
US-East (primary write)
EU-West (read replica) ← European orgs
AP-Southeast (read replica) ← APAC orgs
```

Vercel Edge Functions route reads to the nearest replica.

**Effort**: ~2-3 weeks.

#### 3. Extract wallet service

Wallet pass generation becomes a standalone service on Fly.io or Railway:

- Dedicated CPU/memory for `passkit-generator` and Google JWT signing
- gRPC or HTTP API called by Trigger.dev tasks
- Horizontally scalable (add instances for burst)
- Can pre-generate and cache common pass templates

**Effort**: ~3-4 weeks.

#### 4. Queue-based interaction writes

High-volume interactions (stamp, scan, check-in) go through a queue instead of direct DB writes:

```
API request → Redis queue → Worker → Postgres (batched writes)
```

This absorbs burst traffic (e.g., concert venue with 5,000 ticket scans in 10 minutes) without overwhelming the database.

**Effort**: ~2 weeks.

#### 5. Regional Redis

Deploy Upstash Redis in multiple regions for rate limiting. Upstash Global Database handles this natively with per-region read replicas and single-region writes.

**Effort**: ~1-2 days.

### Estimated infrastructure cost

| Service | Plan | Monthly |
|---------|------|---------|
| Vercel Pro | Current | $20 |
| Neon Postgres | Business (multi-region) | $500-1,000 |
| Upstash Redis | Global | $100-200 |
| Trigger.dev | Team | $100-200 |
| Wallet service (Fly.io) | Dedicated | $50-100 |
| Resend | Business | $50-100 |
| Cloudflare R2 | Paid | $20-50 |
| **Total** | | **$1,000-2,000** |

---

## Tier 4: 50,000+ Orgs — Full Re-architecture

Serverless-on-Vercel stops being optimal. Two paths forward.

### Option A: Decomposed services (stay on Vercel for frontend)

Keep Next.js on Vercel for the dashboard frontend. Extract everything else into dedicated services.

```
                    ┌─────────────┐
                    │  Cloudflare  │
                    │  CDN + WAF   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴───┐ ┌─────┴─────┐
        │  Vercel    │ │  API   │ │  Wallet   │
        │  Frontend  │ │ Server │ │  Service  │
        │  (Next.js) │ │(Fly.io)│ │ (Fly.io)  │
        └─────┬─────┘ └───┬───┘ └─────┬─────┘
              │            │            │
              │       ┌────┴────┐       │
              │       │  Redis  │       │
              │       │ Cluster │       │
              │       └────┬────┘       │
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────┴──────┐
                    │  Postgres   │
                    │  Primary +  │
                    │  Replicas   │
                    │ (partitioned)│
                    └─────────────┘
```

**Components:**

| Service | Runtime | Responsibility |
|---------|---------|----------------|
| Vercel Frontend | Next.js (serverless) | Dashboard UI, SSR, static pages |
| API Server | Node.js on Fly.io | REST API, WebSocket (live updates), high-throughput mutations |
| Wallet Service | Node.js on Fly.io | Pass generation, wallet updates, Apple/Google API calls |
| Queue Workers | Node.js on Fly.io | Interaction processing, webhook delivery, email sending |
| Postgres | RDS or Neon Business | Partitioned by org, primary + regional read replicas |
| Redis Cluster | Upstash Global or ElastiCache | Rate limiting, caching, queues, pub/sub |

**Pros**: Frontend stays serverless (simple deploys), API gets dedicated compute (no cold starts), wallet generation is isolated.

**Cons**: More services to manage, deploy, and monitor. Need proper CI/CD for each service.

### Option B: Leave Vercel entirely

Run Next.js as a standalone Node.js server on Kubernetes (EKS/GKE) or Fly.io.

**Pros**: Full control, no serverless limits, WebSocket support, long-running processes, single deployment pipeline.

**Cons**: Significant ops burden (Kubernetes), lose Vercel preview deploys and CDN integration, need to set up your own CI/CD, monitoring, and scaling.

**Recommendation**: Option A is better unless you have a dedicated DevOps team. Vercel is excellent for the frontend — only extract what doesn't fit serverless.

### Additional changes at this scale

- **Event-driven architecture** — Mutations publish domain events (pass.created, interaction.recorded, contact.updated). Downstream services react: webhook delivery, wallet updates, analytics aggregation, email notifications.
- **Org-level sharding** — If single Postgres can't handle write volume, shard by org ID ranges across multiple database instances.
- **Pre-computed analytics** — AnalyticsSnapshot already exists in the schema. At this scale, move to a time-series database (TimescaleDB) or OLAP engine (ClickHouse) for real-time dashboards.
- **CDN for wallet assets** — Serve generated pass files, QR codes, and wallet images from Cloudflare CDN with long cache TTLs.

### Estimated infrastructure cost

| Service | Plan | Monthly |
|---------|------|---------|
| Vercel Pro | Current | $20 |
| Postgres (RDS/Neon Business) | Multi-region, partitioned | $2,000-4,000 |
| Redis (Upstash Global or ElastiCache) | Cluster | $300-500 |
| API Server (Fly.io) | 4-8 machines | $200-400 |
| Wallet Service (Fly.io) | 2-4 machines | $100-200 |
| Queue Workers (Fly.io) | 2-4 machines | $100-200 |
| Resend | Business | $100-200 |
| Cloudflare R2 + CDN | Paid | $50-100 |
| Monitoring (Datadog/Grafana Cloud) | Pro | $200-500 |
| **Total** | | **$5,000-10,000** |

---

## Summary

| Orgs | Phase | Key Action | Effort | Infra Cost |
|------|-------|------------|--------|------------|
| 0–3,000 | No changes | Monitor | — | $50-160/mo |
| 3,000–10,000 | Optimize | Read replicas, caching, async wallet gen | 2-3 weeks | $300-500/mo |
| 10,000–50,000 | Selective re-arch | Table partitioning, multi-region, extract wallet service | 1-2 months | $1,000-2,000/mo |
| 50,000+ | Full re-arch | Service decomposition, event-driven, sharding | 3-6 months | $5,000-10,000/mo |

### Key Takeaway

The current serverless stack (Vercel + Neon + Upstash + Trigger.dev) comfortably handles **up to 3,000 orgs with zero changes** and **up to 10,000 orgs with targeted optimizations**. Re-architecture is only necessary beyond 10,000 orgs — a problem worth having. Focus on acquiring customers; infrastructure will not be the bottleneck.
