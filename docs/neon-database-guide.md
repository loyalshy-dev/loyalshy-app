# Neon PostgreSQL — Setup & Production Guide

## Initial Setup

### 1. Create Project

- Go to [console.neon.tech](https://console.neon.tech) and sign up
- **New Project** → name `loyalshy`, region closest to Vercel (e.g., `eu-central-1`)
- PostgreSQL version: **18**

### 2. Install Required Extensions

Open the **SQL Editor** in Neon console and run:

```sql
-- Required for uuidv7() function used by all primary keys
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- UUIDv7 generator — time-ordered UUIDs for all PKs
CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid AS $$
DECLARE
  unix_ts_ms bytea;
  uuid_bytes bytea;
BEGIN
  unix_ts_ms = substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3);
  uuid_bytes = unix_ts_ms || gen_random_bytes(10);
  uuid_bytes = set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
  uuid_bytes = set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
  RETURN encode(uuid_bytes, 'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;
```

> **Important:** Run this BEFORE `prisma db push` or any migration. Every table uses `uuidv7()` for primary keys.

### 3. Connection Strings

Neon provides two connection modes. You need both:

| Variable | Mode | Used For |
|----------|------|----------|
| `DATABASE_URL` | Pooled (PgBouncer) | App runtime, serverless functions |
| `DATABASE_URL_UNPOOLED` | Direct | Migrations, seeding, scripts |

In Neon dashboard → **Connection Details**:
- Toggle **"Pooled connection" ON** → copy as `DATABASE_URL`
- Toggle **"Pooled connection" OFF** → copy as `DATABASE_URL_UNPOOLED`

```env
# .env.local
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
DATABASE_URL_UNPOOLED="postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"
```

> **Why two URLs?** PgBouncer (pooled) is required for serverless — it multiplexes connections. But PgBouncer doesn't support DDL operations, advisory locks, or `SET` commands that Prisma migrations need. Always use the unpooled URL for migrations and seeding.

### 4. Push Schema

```bash
npx prisma db push
```

### 5. Seed (optional)

```bash
npx dotenv-cli -e .env.local -- npx tsx prisma/seed.ts
```

> `dotenv-cli` is needed because `tsx` doesn't auto-load `.env.local`. Prisma CLI loads it automatically via `prisma.config.ts`.

---

## Project Architecture

### How Prisma Connects to Neon

```
prisma.config.ts          → DATABASE_URL → used by Prisma CLI (migrate, push, studio)
src/lib/db.ts             → DATABASE_URL → used by app at runtime (lazy Proxy)
prisma/seed.ts            → DATABASE_URL_UNPOOLED → used by seed script
scripts/*.ts              → DATABASE_URL → migration scripts
```

### Lazy Proxy Pattern (`src/lib/db.ts`)

The Prisma client uses a lazy Proxy to avoid constructing `PrismaClient` at import time. This is critical because `next build` runs without `DATABASE_URL` available:

```typescript
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient() // constructed on first access
    const value = Reflect.get(client, prop, client)
    return typeof value === "function" ? value.bind(client) : value
  },
})
```

### Prisma Config (`prisma.config.ts`)

Prisma v7 uses a TypeScript config file instead of putting the URL in `schema.prisma`:

```typescript
export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: { url: process.env.DATABASE_URL },
  migrations: { seed: "npx tsx prisma/seed.ts" },
})
```

The `datasource` block in `schema.prisma` is minimal (no `url` — it comes from config):

```prisma
datasource db {
  provider = "postgresql"
}
```

---

## Production Migrations

### Strategy: `prisma migrate deploy`

For production, **never** use `prisma db push` — it can drop data. Use the migration workflow:

```
Development: prisma migrate dev     → creates migration SQL files
Production:  prisma migrate deploy  → applies pending migrations (no prompts, no data loss)
```

### Migration Workflow

#### 1. Make Schema Changes Locally

Edit `prisma/schema.prisma`, then:

```bash
npx prisma migrate dev --name describe-your-change
```

This:
- Generates a new SQL file in `prisma/migrations/TIMESTAMP_name/migration.sql`
- Applies it to your local/dev database
- Regenerates the Prisma client

#### 2. Review the Generated SQL

Always review the migration SQL before committing:

```bash
cat prisma/migrations/$(ls -t prisma/migrations | head -1)/migration.sql
```

Watch for:
- Unexpected `DROP TABLE` or `DROP COLUMN`
- Missing `DEFAULT` values for new non-nullable columns
- Large table locks (adding columns to tables with millions of rows)

#### 3. Commit the Migration

```bash
git add prisma/migrations/ prisma/schema.prisma
git commit -m "Add field X to model Y"
```

#### 4. Deploy to Production

In your CI/CD pipeline or Vercel build command:

```bash
npx prisma migrate deploy
```

This applies **only** pending migrations that haven't been run yet. It's safe to run multiple times (idempotent).

### Vercel Build Configuration

In `package.json` or Vercel settings, set the build command to:

```json
{
  "scripts": {
    "vercel-build": "prisma migrate deploy && next build"
  }
}
```

Or in Vercel dashboard → **Settings → General → Build Command**:

```
npx prisma migrate deploy && next build
```

> **Important:** Use `DATABASE_URL_UNPOOLED` for migrations on Vercel. Set it in Vercel environment variables. You may need to override `DATABASE_URL` at migration time — see the Neon + Vercel integration section below.

### Handling the `uuidv7()` Function in Migrations

The `uuidv7()` function must exist before any migration runs. Add it as the first migration or as a pre-deploy step:

**Option A: First migration file**

Create `prisma/migrations/00000000000000_init_extensions/migration.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid AS $$
DECLARE
  unix_ts_ms bytea;
  uuid_bytes bytea;
BEGIN
  unix_ts_ms = substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3);
  uuid_bytes = unix_ts_ms || gen_random_bytes(10);
  uuid_bytes = set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
  uuid_bytes = set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
  RETURN encode(uuid_bytes, 'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;
```

**Option B: Pre-deploy script**

```bash
# In your deploy pipeline, before prisma migrate deploy
psql "$DATABASE_URL_UNPOOLED" -f scripts/init-extensions.sql
npx prisma migrate deploy
```

---

## Neon-Specific Best Practices

### Connection Pooling

- **Always use the pooled URL** (`pgbouncer=true`) for your app runtime
- Neon's PgBouncer limits: 10,000 connections per endpoint
- Serverless functions create many short-lived connections — pooling is mandatory
- The `@prisma/adapter-pg` handles connection pooling client-side as well

### Auto-Suspend (Free/Launch Plans)

- Neon computes **auto-suspend after 5 minutes of inactivity** (configurable)
- Cold start: ~500ms on first query after suspend
- **Mitigation:** Set `suspend_timeout_seconds` to 300+ for production, or use Scale plan (always-on)
- For cron jobs or background tasks, the first query warms up the compute automatically

### Database Branching

Neon's killer feature for development:

```
main branch (production)
  ├── preview/pr-123  (Vercel preview deploy)
  ├── preview/pr-456  (Vercel preview deploy)
  └── dev             (local development)
```

**Setup with Vercel integration:**
1. Neon console → **Integrations → Vercel**
2. Authorize and select your project
3. Enable "Create a branch for every Preview Deployment"

Each Vercel preview deploy gets an **instant copy** of your production database (copy-on-write, costs nothing until data diverges).

**Manual branching for local dev:**

```bash
# Create a dev branch from main
neonctl branches create --name dev --parent main

# Get the connection string
neonctl connection-string dev --pooled
```

### Autoscaling

Neon scales compute (CPU/RAM) automatically based on load:

| Plan | Min CU | Max CU | Notes |
|------|--------|--------|-------|
| Free | 0.25 | 0.25 | Fixed, auto-suspend |
| Launch ($19/mo) | 0.25 | 4 | Auto-suspend configurable |
| Scale ($69/mo) | 0.25 | 8 | Always-on option, read replicas |
| Business ($700/mo) | 0.25 | 10 | SLA, priority support |

1 Compute Unit (CU) = 1 vCPU, 4 GB RAM.

For Loyalshy production, **Launch plan** is sufficient to start. Upgrade to Scale when you need read replicas or always-on compute.

---

## Monitoring & Maintenance

### Neon Dashboard Metrics

- **Connections:** Active/idle count — watch for connection leaks
- **Compute hours:** Track usage against plan limits
- **Storage:** Data size growth over time
- **Query performance:** Slow query log (available on Scale+ plans)

### Useful Queries

**Check database size:**
```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
```

**Largest tables:**
```sql
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
```

**Active connections:**
```sql
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
```

**Slow queries (requires pg_stat_statements):**
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**Check for missing indexes (sequential scans on large tables):**
```sql
SELECT relname, seq_scan, seq_tup_read, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_tup_read DESC
LIMIT 10;
```

### Backup & Recovery

Neon handles backups automatically:

| Plan | Retention | Point-in-Time Recovery |
|------|-----------|----------------------|
| Free | 1 day | Last 24 hours |
| Launch | 7 days | Last 7 days |
| Scale | 30 days | Last 30 days |
| Business | 30 days | Last 30 days |

**Restore to a point in time:**
1. Neon console → **Branches → main → Restore**
2. Pick a timestamp
3. Creates a new branch at that point — verify, then promote

**Manual backup (pg_dump):**
```bash
pg_dump "$DATABASE_URL_UNPOOLED" --no-owner --no-acl > backup.sql
```

---

## Troubleshooting

### `ECONNREFUSED` on seed/migration

**Cause:** Using pooled URL for DDL operations.
**Fix:** Use `DATABASE_URL_UNPOOLED`.

### `function uuidv7() does not exist`

**Cause:** The custom function wasn't created on this database/branch.
**Fix:** Run the `CREATE FUNCTION uuidv7()` SQL in Neon SQL Editor (see step 2 above).

### `function gen_random_bytes(integer) does not exist`

**Cause:** The `pgcrypto` extension is not installed.
**Fix:** `CREATE EXTENSION IF NOT EXISTS pgcrypto;`

### Cold start latency (~500ms)

**Cause:** Neon auto-suspended the compute after inactivity.
**Fix:** Increase `suspend_timeout_seconds` in Neon settings, or upgrade to Scale plan for always-on compute.

### `prepared statement already exists` (PgBouncer)

**Cause:** PgBouncer in transaction mode doesn't support named prepared statements.
**Fix:** Ensure your pooled URL includes `pgbouncer=true` — Prisma's adapter handles this automatically.

### Migration drift between branches

**Cause:** Running `prisma db push` on one branch, `prisma migrate dev` on another.
**Fix:** Always use `prisma migrate dev` in development. Use `prisma db push` only for rapid prototyping, then reset with `prisma migrate reset`.

---

## Quick Reference

| Task | Command |
|------|---------|
| Push schema (dev only) | `npx prisma db push` |
| Create migration | `npx prisma migrate dev --name your-change` |
| Apply migrations (production) | `npx prisma migrate deploy` |
| Reset database | `npx prisma migrate reset` |
| Seed data | `npx dotenv-cli -e .env.local -- npx tsx prisma/seed.ts` |
| Open Prisma Studio | `npx prisma studio` |
| Check migration status | `npx prisma migrate status` |
| Generate client | `npx prisma generate` |
