# Neon Database Branches — Setup & Best Practices

## Branch Architecture

Loyalshy uses two Neon database branches to isolate development from production.

| Branch | Purpose | Used By | Data |
|--------|---------|---------|------|
| `development` | Local dev, testing, experimentation | `pnpm dev` on localhost | Throwaway — reset freely |
| `production` | Live deployed app | Vercel deployment | Real user data — treat with care |

Both branches share the same Neon project and PostgreSQL version, but are fully isolated — schema changes on one don't affect the other.

---

## Connection URLs

Each Neon branch provides two connection URLs:

| URL Type | Format | Use For |
|----------|--------|---------|
| **Pooled** | `...-pooler.c-2.eu-central-1.aws.neon.tech` | App runtime (queries, reads, writes) and `prisma db push` |
| **Unpooled (Direct)** | `...c-2.eu-central-1.aws.neon.tech` | Backup for schema operations if pooled fails |

**Pooled vs Unpooled:** The Neon connection pooler (PgBouncer) multiplexes many app connections over a few real PostgreSQL connections — essential for serverless. The direct (unpooled) connection bypasses the pooler and connects straight to PostgreSQL. In practice, `prisma db push` works fine over the pooled connection for Loyalshy.

### Environment Variables

```bash
# .env.local (development branch)
DATABASE_URL="postgresql://...@ep-xxx-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require"
DATABASE_URL_UNPOOLED="postgresql://...@ep-xxx.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require"

# Vercel env vars (production branch — different endpoint)
DATABASE_URL="postgresql://...@ep-yyy-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require"
DATABASE_URL_UNPOOLED="postgresql://...@ep-yyy.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require"
```

### Prisma Configuration

`prisma.config.ts` uses the pooled URL:

```ts
datasource: {
  url: process.env.DATABASE_URL,
},
```

The runtime Prisma client (`src/lib/db.ts`) also uses the pooled URL via the `PrismaPg` adapter:

```ts
new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
})
```

---

## uuidv7() Function

All primary keys use `uuidv7()` (time-sortable UUIDs). This function must exist on every Neon branch before `prisma db push` can create tables.

**The `pg_uuidv7` extension is unreliable on Neon** — it can be orphaned after schema resets because PgBouncer doesn't maintain extension state across sessions. Instead, use a **PL/pgSQL function** that only depends on the `pgcrypto` extension (which is lightweight and stable on Neon).

### Required: pgcrypto extension

The `uuidv7()` function and Better Auth both depend on `gen_random_bytes()`, which requires the `pgcrypto` extension. This must be enabled on **every branch** before anything else:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### uuidv7() function

After `pgcrypto` is enabled, create the `uuidv7()` function:

```sql
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

### Full setup SQL (copy-paste into Neon SQL Editor)

Run this on **every new branch** or **after a reset**:

```sql
-- 1. Enable pgcrypto (required by uuidv7 and Better Auth)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create uuidv7() function (required by all Prisma PKs)
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

-- 3. Verify
SELECT uuidv7();
```

Then run `npx prisma db push` from your terminal.

**Where to run this:**
- **New branch:** Neon SQL Editor before the first `prisma db push`
- **After a reset:** Neon SQL Editor, then `prisma db push`
- **Production:** Must exist before deploy — run once in Neon SQL Editor on the production branch

---

## `db push` vs `migrate` — When to Use Each

| Tool | What it does | When to use |
|------|-------------|-------------|
| `prisma db push` | Compares schema to database, applies changes directly. No SQL files, no history. | Quick prototyping on development. Safe on empty databases. |
| `prisma migrate dev` | Same as push, but also generates a SQL migration file and records it in `_prisma_migrations` table. | **Primary tool for schema changes.** Use this for any change you want to deploy. |
| `prisma migrate deploy` | Runs committed migration SQL files against a database. Never generates new SQL. | **Production only.** Runs automatically on Vercel deploy. |

**Rule of thumb:**
- Changing the schema? → `migrate dev --name describe_change`
- Just experimenting locally and don't care about production yet? → `db push` is fine
- Either way, before deploying you need a migration file committed to git

**On an empty database (no tables, no data),** both `db push` and `migrate deploy` are equally safe — there's nothing to break. But `migrate deploy` is preferred because it establishes the migration history from the start.

---

## Development Workflow

### Day-to-Day Schema Changes

```
1. Edit prisma/schema.prisma
           ↓
2. npx prisma migrate dev --name describe_change
   → applies to development DB
   → creates prisma/migrations/YYYYMMDD_describe_change/migration.sql
           ↓
3. Test locally
           ↓
4. Commit schema.prisma + migration file
           ↓
5. Deploy to Vercel → build runs prisma migrate deploy → applies to production
```

For quick experimentation without creating migration files, you can use `npx prisma db push` instead of step 2. But you'll still need to run `migrate dev` before deploying to create the migration file.

### Seed Data

```bash
npx prisma db seed        # run seed script
```

### When to Reset Development

- After removing enum values — existing rows reference deleted values
- After major schema rewrites
- When dev data is stale or corrupted

**Reset steps:**
1. `npx prisma migrate reset --force` (drops everything)
2. Run the full setup SQL in Neon SQL Editor — `pgcrypto` extension + `uuidv7()` function (see section above)
3. `npx prisma migrate dev` (re-applies all migrations)
4. Re-seed if needed: `npx prisma db seed`

---

## Production Workflow

### Vercel Build Command

The build command in `package.json` handles everything automatically:

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

On every Vercel deploy:
1. `prisma generate` — generates the Prisma client
2. `prisma migrate deploy` — applies any new migration files to production
3. `next build` — builds the Next.js app

### Pre-requisites (one-time setup per branch)

Before the first `migrate deploy` can run against a new/empty production database, the `pgcrypto` extension and `uuidv7()` function must exist. Run the full setup SQL in Neon SQL Editor on the production branch (see uuidv7() section above). This only needs to be done once — migrations don't drop these.

### How a Schema Change Reaches Production

1. You edit `schema.prisma` and run `npx prisma migrate dev --name describe_change` locally
2. This creates a migration SQL file in `prisma/migrations/`
3. You commit and push the migration file alongside the schema change
4. Vercel deploys → `prisma migrate deploy` reads the migrations folder, sees the new file, runs it against production
5. Production schema is updated

`migrate deploy` tracks which migrations have been applied in a `_prisma_migrations` table. It only runs new ones.

### Why Migrate Instead of Push for Production

| | `db push` | `migrate deploy` |
|---|-----------|-------------------|
| **Generates SQL** | On the fly | From committed migration files |
| **Reviewable** | No | Yes — SQL files in git |
| **Reversible** | No | Partially — can write down migrations |
| **Safe for prod** | No | Yes |
| **Data loss risk** | Can drop columns/tables silently | Warns or fails on destructive changes |
| **Team collaboration** | Conflicts silently | Conflicts are visible in git |

---

## Best Practices

### 1. Never Run Destructive Commands Against Production

- `db push --force-reset` — **development only**
- `DROP TABLE`, `DROP SCHEMA` — **development only**
- Always double-check which `DATABASE_URL` is active before running schema commands

### 2. Include pgcrypto + uuidv7() in Migrations

When creating the initial migration, prepend both prerequisites before any CREATE TABLE:

```sql
-- In your first migration file
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

This ensures both are created automatically on fresh databases and in CI.

### 3. Use Neon Branching for Risky Changes

Before a large schema change on production:

1. Create a temporary branch from `production` in the Neon dashboard
2. Test the migration against that branch
3. If it works, apply to production
4. Delete the temporary branch

This gives you a production-like environment to test migrations without risk.

### 4. Protect the Production Branch

In the Neon dashboard:
- Enable **IP allowlisting** for production (only Vercel's IPs)
- Use separate credentials for production vs development
- Enable **point-in-time recovery** on the production branch

### 5. Monitor Connection Usage

Neon's free/pro tiers have connection limits. The pooler helps, but monitor:
- Active connections in Neon dashboard
- Connection errors in Sentry
- Slow queries via Neon's query insights

### 6. Backup Before Major Migrations

Before running destructive migrations on production:
1. Note the current LSN (Log Sequence Number) in Neon dashboard
2. Run the migration
3. If something goes wrong, use Neon's point-in-time restore

---

## Troubleshooting

### "function uuidv7() does not exist"

Run the full setup SQL in **Neon SQL Editor** (see uuidv7() section above) — both `pgcrypto` and the function. Do NOT rely on `CREATE EXTENSION pg_uuidv7` — it gets orphaned on Neon after schema resets.

### "function gen_random_bytes(integer) does not exist"

The `pgcrypto` extension is missing. Run in Neon SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

This is needed by the `uuidv7()` function and by Better Auth (for generating secure IDs).

### "table does not exist" after reset

`--force-reset` drops everything including extensions. Fix:
1. Run the full setup SQL in Neon SQL Editor (pgcrypto + uuidv7)
2. Run `npx prisma db push`

### "enum value still referenced" on db push

Existing rows reference a deleted enum value. Either:
- Delete those rows first via SQL
- Use `--force-reset` (development only)
- Write a migration that updates rows before altering the enum (production)

### Pooled connection fails for schema operations

If `prisma db push` fails over the pooled connection, temporarily switch `prisma.config.ts` to use `DATABASE_URL_UNPOOLED`:

```ts
datasource: {
  url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
},
```

Remember to switch back after the operation.

---

## Quick Reference

| Task | Command | Branch |
|------|---------|--------|
| Push schema (dev) | `npx prisma db push` | development |
| Reset dev database | `npx prisma db push --force-reset` | development |
| Create migration | `npx prisma migrate dev --name xyz` | development |
| Deploy migration | `npx prisma migrate deploy` | production |
| Seed data | `npx prisma db seed` | development |
| Run raw SQL | `echo "SQL" \| npx prisma db execute --stdin` | either |
| Generate client | `npx prisma generate` | N/A (local) |
| Open Prisma Studio | `npx prisma studio` | whichever URL is configured |
