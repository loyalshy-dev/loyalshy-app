# Fidelio — Digital Loyalty Card SaaS

Multi-tenant SaaS for restaurants to create digital loyalty cards with Apple and Google Wallet passes. Restaurant staff register customer visits; after N visits, customers earn rewards.

## Tech Stack

Next.js 16 | React 19 | Prisma 7 | PostgreSQL 18 | Better Auth | Stripe | Trigger.dev | Tailwind CSS 4 | shadcn/ui

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 18 (or Docker)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up the database

```bash
# Start PostgreSQL (Docker example)
docker run -d --name fidelio-db \
  -e POSTGRES_USER=fidelio \
  -e POSTGRES_PASSWORD=fidelio \
  -e POSTGRES_DB=fidelio \
  -p 5433:5432 \
  postgres:18

# Run migrations
pnpm prisma migrate dev

# Seed the database (optional)
pnpm prisma db seed
```

### 3. Configure environment variables

Copy `.env.local` and fill in the values. See sections below for service-specific setup.

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Google Wallet Setup (Free)

Google Wallet passes require a Google Cloud service account and an Issuer ID. No paid program is needed.

### Step 1 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **New Project** (e.g. "Fidelio Dev")
3. Note the **Project ID**

### Step 2 — Enable the Google Wallet API

1. In the GCP console, go to **APIs & Services > Library**
2. Search for **"Google Wallet API"**
3. Click **Enable**

### Step 3 — Create a service account

1. Go to **IAM & Admin > Service Accounts**
2. Click **Create Service Account**
3. Name: `fidelio-wallet` (or anything you prefer)
4. Skip the optional role assignment
5. Click **Done**
6. Click the service account you just created
7. Go to **Keys** tab > **Add Key** > **Create new key** > **JSON**
8. A `.json` file will download — save it securely

### Step 4 — Get a Wallet Issuer ID

1. Go to [pay.google.com/business/console](https://pay.google.com/business/console)
2. Sign up for the **Google Wallet API** issuer account
3. Note your **Issuer ID** (a numeric string)
4. Go to **Manage > API access** and add your service account email (from step 3) with the **Developer** role

### Step 5 — Set environment variables

Add to `.env.local`:

```env
GOOGLE_WALLET_ISSUER_ID="your-issuer-id"
GOOGLE_WALLET_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n","client_email":"...@....iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}'
```

Paste the **entire downloaded JSON** as a single-line string, or base64-encode it. Both formats are supported.

### Testing Google Wallet

1. Start the dev server (`pnpm dev`)
2. Log in and create a restaurant with a loyalty program
3. Add a customer
4. Issue a Google Wallet pass from the customer detail view
5. Or test the public flow at `/join/[your-restaurant-slug]`

> **Note:** You need a real Android device or a Google account signed into Chrome to save the pass. On desktop, Google shows a preview only.

---

## Apple Wallet Setup ($99/year)

Apple Wallet passes require an Apple Developer Program membership and signing certificates. There is no free tier.

### Step 1 — Enroll in Apple Developer Program

1. Go to [developer.apple.com/programs](https://developer.apple.com/programs/)
2. Enroll ($99/year)
3. Wait for approval (usually within 48 hours)

### Step 2 — Create a Pass Type ID

1. Go to [developer.apple.com/account](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles > Identifiers**
3. Click **+** and select **Pass Type IDs**
4. Enter a description (e.g. "Fidelio Loyalty") and identifier (e.g. `pass.com.yourcompany.fidelio`)
5. Click **Register**

### Step 3 — Create a Pass signing certificate

1. Go to **Certificates** and click **+**
2. Under **Services**, select **Pass Type ID Certificate**
3. Select your Pass Type ID from step 2
4. Follow the prompts to create a CSR (Certificate Signing Request) using Keychain Access on macOS:
   - Open **Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority**
   - Enter your email, set "Common Name" to anything, select "Saved to disk"
5. Upload the CSR file
6. Download the generated certificate (`.cer` file)
7. Double-click to install it in Keychain Access

### Step 4 — Export the certificate and key

1. In **Keychain Access**, find the certificate under **My Certificates** (it will show your Pass Type ID)
2. Expand it to see the private key
3. Right-click the **certificate** (not the key) > **Export** > save as `.p12` (set a passphrase)
4. Convert to PEM format:

```bash
# Extract the certificate
openssl pkcs12 -in pass.p12 -clcerts -nokeys -out pass-cert.pem

# Extract the private key
openssl pkcs12 -in pass.p12 -nocerts -out pass-key.pem
```

### Step 5 — Download the WWDR certificate

1. Download the **Apple WWDR G4 Certificate** from [apple.com/certificateauthority](https://www.apple.com/certificateauthority/)
   - Direct link: `Apple Worldwide Developer Relations Certification Authority - G4`
2. Convert to PEM if needed:

```bash
openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem
```

### Step 6 — Base64-encode and set environment variables

```bash
# Encode each file
base64 -i pass-cert.pem | tr -d '\n'
base64 -i pass-key.pem | tr -d '\n'
base64 -i wwdr.pem | tr -d '\n'
```

Add to `.env.local`:

```env
APPLE_PASS_TYPE_IDENTIFIER="pass.com.yourcompany.fidelio"
APPLE_TEAM_IDENTIFIER="YOUR_TEAM_ID"
APPLE_PASS_CERTIFICATE="base64-encoded-pass-cert.pem"
APPLE_PASS_KEY="base64-encoded-pass-key.pem"
APPLE_PASS_KEY_PASSPHRASE="the-passphrase-you-set"
APPLE_WWDR_CERTIFICATE="base64-encoded-wwdr.pem"
```

Your Team Identifier can be found at [developer.apple.com/account](https://developer.apple.com/account) under **Membership Details**.

### Testing Apple Wallet

1. Start the dev server
2. Issue an Apple Wallet pass from the dashboard or `/join/[slug]`
3. On macOS, the `.pkpass` file opens in a Wallet preview
4. On iOS (real device or Simulator), it prompts to add to Wallet

---

## Other Services

| Service | Required | Setup |
|---------|----------|-------|
| **Stripe** | For billing | [dashboard.stripe.com](https://dashboard.stripe.com) — use test mode keys |
| **Resend** | For emails | [resend.com](https://resend.com) — free tier available |
| **Trigger.dev** | For background jobs | [trigger.dev](https://trigger.dev) — free tier available |
| **Vercel Blob** | For file uploads | [vercel.com](https://vercel.com) — included with Vercel |
| **Sentry** | For error tracking | [sentry.io](https://sentry.io) — free tier available |
| **Plausible** | For analytics | [plausible.io](https://plausible.io) — optional, privacy-first |

## Project Structure

```
/src
  /app              — App Router pages
    /(auth)         — Login / Register / Forgot password
    /(dashboard)    — Protected dashboard routes
    /(public)       — Landing, pricing, QR scan pages
    /api            — API routes
  /components       — Reusable UI components
  /lib              — Utilities, DB client, auth, DAL
  /server           — Server actions
  /trigger          — Trigger.dev job definitions
/e2e                — Playwright E2E tests
/prisma             — Schema & migrations
```

## Scripts

```bash
pnpm dev              # Start dev server (Turbopack)
pnpm build            # Production build
pnpm test             # Run Vitest unit tests
pnpm test:e2e         # Run Playwright E2E tests
pnpm prisma studio    # Open Prisma Studio
pnpm prisma migrate dev  # Run migrations
```
