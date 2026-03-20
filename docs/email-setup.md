# Email Setup — Loyalshy

Custom domain email for `loyalshy.com` using Cloudflare Email Routing (free) + Resend SMTP + Gmail.

## Architecture

```
Inbound:  sender → hello@loyalshy.com → Cloudflare Email Routing → loyalshy.dev@gmail.com
Outbound: Gmail → Resend SMTP → recipient sees "from: hello@loyalshy.com"
```

| Layer    | Service                  | Cost |
|----------|--------------------------|------|
| Sending  | Resend (already configured) | Free tier / existing plan |
| Receiving | Cloudflare Email Routing | Free |
| Inbox    | Gmail (loyalshy.dev@gmail.com) | Free |

## Prerequisites

- Cloudflare DNS active on `loyalshy.com` (already configured)
- Resend account with `loyalshy.com` domain verified (already configured)
- Resend API key (in `.env.local` as `RESEND_API_KEY`)

---

## Part 1: Cloudflare Email Routing (receiving)

### 1.1 Enable Email Routing

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select **loyalshy.com**
3. Go to **Email Routing** in the left sidebar
4. Click **Get started** (if first time) or go to **Email Routing → Routes**
5. Cloudflare will prompt to add MX and TXT records — click **Add records and enable**

> Cloudflare automatically adds the required MX records. If you had existing MX records, Cloudflare will warn you — remove old ones.

### 1.2 Add destination address

1. Go to **Email Routing → Destination addresses**
2. Click **Add destination address**
3. Enter: `loyalshy.dev@gmail.com`
4. Check your Gmail for a verification email from Cloudflare — click the confirmation link

### 1.3 Create routing rules

Go to **Email Routing → Routes** and create these rules:

| Custom address | Action | Destination |
|---|---|---|
| `hello@loyalshy.com` | Forward to | `loyalshy.dev@gmail.com` |
| `sales@loyalshy.com` | Forward to | `loyalshy.dev@gmail.com` |
| `noreply@loyalshy.com` | Drop | — (no inbox needed) |

**Optional catch-all**: At the bottom of the Routes page, set the catch-all to forward to `loyalshy.dev@gmail.com`. This catches typos and any other `@loyalshy.com` address.

### 1.4 Verify it works

Send a test email from a personal account to `hello@loyalshy.com`. It should arrive in your Gmail inbox within a few seconds.

---

## Part 2: Gmail "Send as" aliases (replying as @loyalshy.com)

### 2.1 Resend SMTP credentials

These are the same for all aliases:

| Setting | Value |
|---|---|
| SMTP Server | `smtp.resend.com` |
| Port | `465` (SSL) |
| Username | `resend` |
| Password | Your Resend API key |

### 2.2 Add hello@loyalshy.com

1. Open Gmail → click the gear icon → **See all settings**
2. Go to **Accounts and Import** tab
3. Under **Send mail as**, click **Add another email address**
4. In the popup:
   - **Name**: `Loyalshy`
   - **Email address**: `hello@loyalshy.com`
   - **Treat as an alias**: checked (leave default)
   - Click **Next Step**
5. Enter SMTP credentials:
   - **SMTP Server**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: *(paste your Resend API key)*
   - Select **Secured connection using SSL**
   - Click **Add Account**
6. Gmail sends a verification email to `hello@loyalshy.com`
   - Cloudflare forwards it to your Gmail
   - Open the email and click the confirmation link (or enter the code)

### 2.3 Add sales@loyalshy.com

Repeat the exact same steps as 2.2 with:

- **Name**: `Loyalshy Sales`
- **Email address**: `sales@loyalshy.com`
- Same SMTP credentials

### 2.4 Set default "From" address

1. In Gmail → Settings → **Accounts and Import** → **Send mail as**
2. Click **make default** next to `hello@loyalshy.com`
3. Set **When replying to a message** to: **Reply from the same address the message was sent to**

This ensures replies to `sales@loyalshy.com` automatically use that address.

---

## Part 3: DNS records summary

After setup, your Cloudflare DNS should have these email-related records:

| Type | Name | Value | Purpose |
|---|---|---|---|
| MX | `loyalshy.com` | `isaac.mx.cloudflare.net` | Cloudflare Email Routing |
| MX | `loyalshy.com` | `linda.mx.cloudflare.net` | Cloudflare Email Routing |
| TXT | `loyalshy.com` | `v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all` | SPF (Cloudflare + Resend) |

> **Important**: Your SPF record must include both Cloudflare (`_spf.mx.cloudflare.net`) and Resend (`amazonses.com`). If Resend uses a different SPF include, check your Resend dashboard under Domain settings.

DKIM records for Resend should already be configured (set up during initial Resend domain verification).

---

## Part 4: How it all works together

### Contact form flow

1. User submits contact form on `/contact`
2. Server action (`contact-form-actions.ts`) sends via Resend:
   - **Team notification** → `hello@loyalshy.com` (or `sales@loyalshy.com` for sales inquiries)
   - **Confirmation** → user's email (from `noreply@loyalshy.com`)
3. Cloudflare forwards team notification to `loyalshy.dev@gmail.com`
4. You reply from Gmail as `hello@loyalshy.com` via Resend SMTP

### Transactional emails (OTP, welcome, invitations)

These are sent from `noreply@loyalshy.com` via Resend and don't need an inbox — they're one-way notifications.

### Email addresses in use

| Address | Purpose | Needs inbox? |
|---|---|---|
| `hello@loyalshy.com` | General contact, legal pages, FAQ | Yes (Gmail) |
| `sales@loyalshy.com` | Enterprise/sales inquiries | Yes (Gmail) |
| `noreply@loyalshy.com` | Transactional emails (OTP, welcome, passes) | No (drop) |

---

## Troubleshooting

### Emails not forwarding

- Check Cloudflare Email Routing is **enabled** (not paused)
- Verify destination address is confirmed (green checkmark in Cloudflare)
- Check Gmail spam folder

### Gmail "Send as" verification email not arriving

- Ensure the Cloudflare route for that address exists and is active
- Check spam/junk folder
- Try the "resend verification" link in Gmail settings

### Resend SMTP authentication failed

- Verify the API key is correct (same one in `.env.local`)
- Ensure the API key has send permissions
- Port must be `465` with SSL (not `587`)

### Emails landing in spam

- Verify SPF record includes both Cloudflare and Resend
- Verify DKIM records are set up in Cloudflare (from Resend dashboard)
- Check [mail-tester.com](https://www.mail-tester.com) — send a test email and get a score
- Avoid sending from a brand new domain with no history — warm up gradually
