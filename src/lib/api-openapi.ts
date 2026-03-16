/** Builds the OpenAPI 3.1 specification for the Loyalshy API. */
export function buildOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Loyalshy API",
      version: "1.0.0",
      description: `Manage contacts, passes, interactions, and webhooks for your digital wallet pass programs.

## Authentication

All requests require a Bearer token in the \`Authorization\` header:

\`\`\`
Authorization: Bearer lsk_live_...
\`\`\`

API keys are created in **Settings → API** in your dashboard. Each key is scoped to a single organization.

## Response Envelope

All successful responses follow a consistent envelope:

\`\`\`json
{
  "data": { ... },
  "meta": {
    "requestId": "req_01HZ...",
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 142,
      "pageCount": 8
    }
  }
}
\`\`\`

- \`data\` contains the resource(s) — an object for single resources, an array for lists.
- \`meta.requestId\` is included on every response for support and debugging.
- \`meta.pagination\` is included on list endpoints only.

## Rate Limiting

Rate limits are per-organization and depend on your plan:

| Plan | Requests/min | Requests/day |
|------|-------------|-------------|
| Free | 5 | 100 |
| Starter | 20 | 1,000 |
| Growth | 60 | 10,000 |
| Scale | 300 | 100,000 |
| Enterprise | 600 | Unlimited |

Response headers:
- \`X-RateLimit-Limit\` — max requests per window
- \`X-RateLimit-Remaining\` — requests remaining
- \`X-RateLimit-Reset\` — UTC epoch seconds when the window resets

When rate limited, the API returns \`429 Too Many Requests\`.

## Pagination

List endpoints accept \`page\` (default: 1) and \`per_page\` (default: 20, max: 100) query parameters. The response includes a \`meta.pagination\` object with \`page\`, \`perPage\`, \`total\`, and \`pageCount\`.

## Idempotency

For POST and PATCH requests, you may include an \`Idempotency-Key\` header to safely retry requests. Keys are valid for 24 hours.

\`\`\`
Idempotency-Key: my-unique-key-123
\`\`\`

## Errors

Errors follow [RFC 7807 Problem Details](https://datatracker.ietf.org/doc/html/rfc7807) format:

\`\`\`json
{
  "status": 422,
  "title": "Validation Error",
  "detail": "Request body failed validation.",
  "errors": [
    { "field": "fullName", "message": "Required" }
  ]
}
\`\`\`

| Status | Meaning |
|--------|---------|
| 400 | Bad Request — malformed JSON or invalid parameters |
| 401 | Unauthorized — missing or invalid API key |
| 403 | Forbidden — key lacks required scope |
| 404 | Not Found — resource doesn't exist in your org |
| 409 | Conflict — duplicate (e.g. email already exists) |
| 422 | Validation Error — request body failed schema validation |
| 429 | Rate Limited — slow down and retry after the reset time |
| 500 | Internal Error — unexpected server failure |

When you receive a \`429\`, check the \`Retry-After\` header (seconds) or \`X-RateLimit-Reset\` (epoch) to know when to retry. Use exponential backoff for best results.

---

## Getting Started

### 1. Create an API key

Go to **Settings → API** in your Loyalshy dashboard and click **Create API Key**. Give it a name (e.g., "Production") and copy the key — it starts with \`lsk_live_\` and is only shown once.

### 2. Make your first request

\`\`\`bash
curl https://your-domain.com/api/v1/stats \\
  -H "Authorization: Bearer lsk_live_your_key_here"
\`\`\`

You should get back your organization's aggregate statistics:

\`\`\`json
{
  "data": {
    "totalContacts": 0,
    "totalPassInstances": 0,
    "activePassInstances": 0,
    "totalInteractions": 0,
    "totalRewards": 0,
    "redeemedRewards": 0
  },
  "meta": { "requestId": "req_01HZ3KFGP4NXJ" }
}
\`\`\`

### 3. Understand the response envelope

Every response wraps data in \`{ data, meta }\`. List endpoints add \`meta.pagination\`. Errors return a flat RFC 7807 object (no envelope). The \`meta.requestId\` is useful when contacting support.

### 4. Handle errors gracefully

Always check the HTTP status code. For \`422\` responses, the \`errors\` array tells you exactly which fields failed. For \`429\`, wait for \`Retry-After\` seconds before retrying.

---

## Issuing Your First Pass

This walkthrough creates a contact, finds a template, issues a pass, and performs an action — the core workflow of the Loyalshy API.

### Step 1: Create a contact

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/contacts \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"fullName": "Jane Smith", "email": "jane@example.com"}'
\`\`\`

Save the \`data.id\` from the response — you'll need it to issue a pass.

### Step 2: Find an active template

\`\`\`bash
curl "https://your-domain.com/api/v1/templates?status=ACTIVE" \\
  -H "Authorization: Bearer lsk_live_..."
\`\`\`

Pick a template from the list. Note its \`id\` and \`passType\` (e.g., \`STAMP_CARD\`).

### Step 3: Issue the pass

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"templateId": "TEMPLATE_ID", "contactId": "CONTACT_ID"}'
\`\`\`

The response includes the new pass instance with its initial state (e.g., \`{ "stampsCollected": 0 }\` for a stamp card).

### Step 4: Perform an action

Now stamp the card:

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes/PASS_ID/actions \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"action": "stamp"}'
\`\`\`

The response shows the updated state and the interaction that was created:

\`\`\`json
{
  "data": {
    "action": "stamp",
    "passInstanceId": "...",
    "result": { "stampsCollected": 1, "stampsRequired": 10, "completed": false },
    "interaction": { "id": "...", "type": "STAMP", "createdAt": "..." }
  }
}
\`\`\`

Each pass type has its own actions — see the **Passes > Perform a type-specific action** endpoint for the full action-to-type mapping.

---

## Use Cases

Real-world integration examples showing the full API flow for common scenarios.

---

### Venue Ticketing — Issue tickets from your booking system

**Scenario:** A music venue sells tickets through their own website and wants each ticket to appear as a wallet pass with a scannable QR code at the door.

**Setup (once):**
1. Create a **Ticket** template in your Loyalshy dashboard (e.g., "Jazz Night VIP")
2. Design the pass in the card studio — add event name, date, venue address, and a strip image
3. Activate the template
4. Go to **Settings → API**, create an API key, and copy it
5. Note the template ID from **Programs → your ticket → URL** (the UUID in the URL)

**Integration flow (per booking):**

**Step 1: Issue the ticket when the customer completes checkout**

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: booking-12345" \\
  -d '{
    "templateId": "YOUR_TICKET_TEMPLATE_ID",
    "contact": {
      "fullName": "Maria Garcia",
      "email": "maria@example.com",
      "phone": "+34612345678"
    },
    "sendEmail": true
  }'
\`\`\`

This single call: creates the contact (or finds existing by email/phone), issues the ticket pass, sends a confirmation email with Apple Wallet and Google Wallet download buttons, and returns wallet URLs you can embed in your own confirmation page.

The \`Idempotency-Key\` ensures retries from network failures won't create duplicate tickets.

**Step 2: Use the wallet URLs in your own confirmation page**

The response includes \`walletUrls\` you can embed directly:

\`\`\`json
{
  "data": {
    "id": "pass_xyz",
    "walletUrls": {
      "cardUrl": "https://loyalshy.com/join/venue-slug/card/pass_xyz?sig=...",
      "appleWalletUrl": "https://r2.dev/passes/pass_xyz.pkpass",
      "googleWalletUrl": "https://loyalshy.com/api/wallet/download/pass_xyz?sig=...&platform=google"
    },
    "emailSent": true
  }
}
\`\`\`

- \`cardUrl\` — link to the browser-viewable card (works on any device)
- \`appleWalletUrl\` — direct \`.pkpass\` download (iOS Safari opens the native "Add to Wallet" dialog)
- \`googleWalletUrl\` — download link for Google Wallet on Android

**Step 3: Scan tickets at the door**

When your staff scans a ticket QR code, call the scan action:

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes/PASS_ID/actions \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"action": "scan"}'
\`\`\`

The response includes the updated scan count. Calling scan twice on the same ticket is idempotent — use the \`scanCount\` in the response to detect re-entry.

**Step 4 (optional): Listen for events via webhooks**

Set up a webhook to receive \`pass.issued\` and \`interaction.created\` events. This lets you track ticket issuance and door scans in real-time without polling.

---

### Coffee Shop Loyalty — Stamp cards with rewards

**Scenario:** A coffee chain issues digital stamp cards. Customers earn a stamp per purchase and get a free drink after 10 stamps.

**Setup (once):**
1. Create a **Stamp Card** template in the dashboard — set stamps required to 10, reward description to "Free drink of your choice"
2. Activate the template and create an API key

**Integration flow:**

**Step 1: Register a new customer at the POS**

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "templateId": "YOUR_STAMP_TEMPLATE_ID",
    "contact": {
      "fullName": "Alex Chen",
      "email": "alex@example.com"
    },
    "sendEmail": true
  }'
\`\`\`

The customer receives an email with buttons to add the stamp card to Apple Wallet or Google Wallet.

**Step 2: Add a stamp on each purchase**

When the customer pays, stamp their card:

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes/PASS_ID/actions \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"action": "stamp"}'
\`\`\`

Response:

\`\`\`json
{
  "data": {
    "action": "stamp",
    "result": {
      "stampsCollected": 7,
      "stampsRequired": 10,
      "completed": false
    }
  }
}
\`\`\`

When the card completes (10/10 stamps), the response includes \`"completed": true\` and a reward is automatically created.

**Step 3: Check a customer's passes**

Look up a customer by email to find their pass:

\`\`\`bash
curl "https://your-domain.com/api/v1/contacts?search=alex@example.com" \\
  -H "Authorization: Bearer lsk_live_..."
\`\`\`

Then fetch their pass detail:

\`\`\`bash
curl "https://your-domain.com/api/v1/passes?contact_id=CONTACT_ID&template_id=TEMPLATE_ID" \\
  -H "Authorization: Bearer lsk_live_..."
\`\`\`

---

### Gym Membership — Access passes with check-ins

**Scenario:** A gym chain issues digital membership cards. Members check in by scanning their pass at the entrance.

**Setup (once):**
1. Create a **Membership** template — set duration (e.g., 12 months) and membership tiers if needed
2. Activate the template and create an API key

**Integration flow:**

**Step 1: Issue membership when a member signs up**

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "templateId": "YOUR_MEMBERSHIP_TEMPLATE_ID",
    "contact": {
      "fullName": "Sarah Johnson",
      "email": "sarah@example.com",
      "phone": "+44 7911 123456"
    },
    "sendEmail": true
  }'
\`\`\`

The member receives their digital membership card via email with wallet download links.

**Step 2: Record check-ins at the door**

When the member scans their pass at the gym entrance:

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes/PASS_ID/actions \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"action": "check_in"}'
\`\`\`

**Step 3: Monitor activity via stats**

Track daily check-in trends:

\`\`\`bash
curl "https://your-domain.com/api/v1/stats/daily?from=2026-03-01&to=2026-03-12" \\
  -H "Authorization: Bearer lsk_live_..."
\`\`\`

---

### Bulk Import — Migrate existing customers

**Scenario:** You have an existing customer database and want to import them into Loyalshy with passes.

**Step 1: Bulk create contacts with pass issuance**

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/contacts/bulk \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "contacts": [
      {"fullName": "Alice Brown", "email": "alice@example.com"},
      {"fullName": "Bob Wilson", "email": "bob@example.com", "phone": "+1555123456"},
      {"fullName": "Carol Davis", "email": "carol@example.com"}
    ],
    "issueTemplateId": "YOUR_TEMPLATE_ID"
  }'
\`\`\`

This creates up to 200 contacts per call and optionally issues a pass from the specified template to each one.

**Step 2: Repeat for remaining contacts**

Page through your customer database in batches of 200. The API is idempotent on email — contacts with duplicate emails are skipped (reported in the response).

---

### Real-Time Sync — Webhooks for external systems

**Scenario:** You want to keep your CRM, analytics, or POS in sync with Loyalshy events.

**Step 1: Register a webhook endpoint**

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/webhooks \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-app.com/webhooks/loyalshy",
    "events": [
      "contact.created",
      "pass.issued",
      "pass.completed",
      "interaction.created",
      "reward.earned",
      "reward.redeemed"
    ]
  }'
\`\`\`

Save the \`secret\` from the response — you need it to verify webhook signatures.

**Step 2: Verify webhook signatures in your handler**

Every webhook delivery includes \`X-Loyalshy-Signature\` and \`X-Loyalshy-Timestamp\` headers. Verify the HMAC-SHA256 signature to ensure authenticity:

\`\`\`javascript
import crypto from "crypto";

function verifyWebhook(body, signature, timestamp, secret) {
  const payload = timestamp + "." + body;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
\`\`\`

**Step 3: Handle events**

\`\`\`javascript
app.post("/webhooks/loyalshy", (req, res) => {
  // Verify signature first (see above)

  const { event, data } = req.body;

  switch (event) {
    case "pass.issued":
      // Sync new pass to your CRM
      crm.addNote(data.pass.contact.email, "Loyalshy pass issued");
      break;
    case "pass.completed":
      // Stamp card completed — trigger promotion in your system
      analytics.track("loyalty_reward_earned", data);
      break;
    case "interaction.created":
      // Log visit in your POS
      pos.logVisit(data.interaction);
      break;
  }

  res.sendStatus(200); // Acknowledge receipt
});
\`\`\`

Webhooks are retried up to 5 times with exponential backoff. Endpoints that fail 10 times consecutively are automatically disabled — you can re-enable them in the dashboard or via the API.

---

### University Student ID — Digital campus identity cards

**Scenario:** A university issues digital student IDs that work as campus building access, library cards, and exam verification — replacing plastic cards.

**Setup (once):**
1. Create a **Business ID** template in the dashboard — add fields for student name, student number, faculty, and expiry date
2. Design the pass in the card studio — add the university logo, student photo placeholder, and campus branding
3. Set validity duration (e.g., 1 academic year)
4. Activate the template and create an API key

**Integration flow:**

**Step 1: Issue student ID when enrollment is confirmed**

Connect your student information system (SIS) to issue IDs automatically after enrollment:

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: enrollment-2026-STU-48291" \\
  -d '{
    "templateId": "YOUR_STUDENT_ID_TEMPLATE_ID",
    "contact": {
      "fullName": "Emma Rodriguez",
      "email": "e.rodriguez@university.edu",
      "phone": "+34655123456"
    },
    "sendEmail": true
  }'
\`\`\`

The student receives their digital ID via email with Apple Wallet and Google Wallet buttons. The \`Idempotency-Key\` tied to the enrollment ID prevents duplicates if your SIS retries.

**Step 2: Verify identity at campus checkpoints**

When a student scans their pass at the library, lab, or exam hall:

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes/PASS_ID/actions \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"action": "verify"}'
\`\`\`

Each verification is logged as an \`ID_VERIFY\` interaction with a timestamp — useful for attendance tracking and building access audits.

**Step 3: Embed wallet links in the student portal**

Use the \`walletUrls\` from the response to add "Add to Wallet" buttons on your student portal:

\`\`\`javascript
// After issuing the ID
const { data: pass } = await res.json();

// Render on your student portal
const walletLinks = {
  viewOnline: pass.walletUrls.cardUrl,
  addToiPhone: pass.walletUrls.appleWalletUrl,
  addToAndroid: pass.walletUrls.googleWalletUrl,
};
\`\`\`

**Step 4: Monitor usage and revoke on graduation/withdrawal**

Track verification activity across campus:

\`\`\`bash
curl "https://your-domain.com/api/v1/interactions?type=ID_VERIFY&since=2026-09-01T00:00:00Z" \\
  -H "Authorization: Bearer lsk_live_..."
\`\`\`

When a student graduates or withdraws, revoke their ID by updating the pass status:

\`\`\`bash
curl -X PATCH https://your-domain.com/api/v1/passes/PASS_ID \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"status": "REVOKED"}'
\`\`\`

---

### Public Transit / Bus Pass — Digital monthly passes

**Scenario:** A city transit agency issues monthly bus passes as wallet passes. Passengers board by scanning their pass, and the system tracks boardings and exits per route.

**Setup (once):**
1. Create a **Transit** template — set the validity period (e.g., 30 days), zone coverage, and route info
2. Design the pass with the transit authority logo, route map strip image, and zone indicator
3. Activate the template and create an API key

**Integration flow:**

**Step 1: Issue a monthly pass when the passenger purchases online**

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-TRN-20260312-7841" \\
  -d '{
    "templateId": "YOUR_TRANSIT_TEMPLATE_ID",
    "contact": {
      "fullName": "Lucas Fernandez",
      "email": "lucas.f@email.com"
    },
    "sendEmail": true
  }'
\`\`\`

The passenger gets an email with wallet download links. The pass shows on their lock screen when they're near a bus stop (Apple Wallet location-triggered).

**Step 2: Record boarding when the passenger taps at the door scanner**

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes/PASS_ID/actions \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"action": "board"}'
\`\`\`

Response:

\`\`\`json
{
  "data": {
    "action": "board",
    "passInstanceId": "...",
    "result": { "boardingCount": 47 },
    "interaction": { "id": "...", "type": "TRANSIT_BOARD", "createdAt": "..." }
  }
}
\`\`\`

**Step 3: Record exit (optional, for zone-based billing)**

If your system tracks exits for zone validation:

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes/PASS_ID/actions \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"action": "exit"}'
\`\`\`

**Step 4: Analyze ridership with daily stats**

Track boarding trends to optimize routes and schedules:

\`\`\`bash
curl "https://your-domain.com/api/v1/stats/daily?from=2026-03-01&to=2026-03-12" \\
  -H "Authorization: Bearer lsk_live_..."
\`\`\`

**Step 5: Auto-expire and renew**

Transit passes have a built-in expiry date. When a pass expires, the status changes automatically. Set up a webhook on \`pass.expired\` to trigger a renewal reminder in your billing system:

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/webhooks \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://transit-billing.example.com/webhooks/loyalshy",
    "events": ["pass.expired"]
  }'
\`\`\`

---

### Gift Card — Digital store credit and gifting

**Scenario:** A retail chain sells digital gift cards online. Buyers purchase a gift card for someone, the recipient gets an email with wallet links, and staff charge the balance at the register.

**Setup (once):**
1. Create a **Gift Card** template — set the initial balance (e.g., €50), currency, and optional expiry (e.g., 12 months)
2. Design the pass with your brand — gift cards look great with a strip image and bold balance display
3. Activate the template and create an API key

**Integration flow:**

**Step 1: Issue a gift card when the buyer completes purchase**

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-GC-20260312-5523" \\
  -d '{
    "templateId": "YOUR_GIFT_CARD_TEMPLATE_ID",
    "contact": {
      "fullName": "Sophie Martin",
      "email": "sophie.m@email.com"
    },
    "sendEmail": true
  }'
\`\`\`

Sophie receives a beautifully branded email with her gift card and wallet download buttons. The gift card starts with the configured initial balance (e.g., €50.00).

**Step 2: Charge the balance at the register**

When Sophie pays with her gift card in-store, charge the amount:

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes/PASS_ID/actions \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"action": "charge", "amountCents": 1850}'
\`\`\`

Response:

\`\`\`json
{
  "data": {
    "action": "charge",
    "passInstanceId": "...",
    "result": {
      "balanceCents": 3150,
      "currency": "EUR",
      "charged": 1850
    },
    "interaction": { "id": "...", "type": "GIFT_CHARGE", "createdAt": "..." }
  }
}
\`\`\`

The wallet pass updates automatically to show the new balance (€31.50).

**Step 3: Process refunds back to the gift card**

If Sophie returns an item, refund back to the gift card:

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/passes/PASS_ID/actions \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"action": "refund", "amountCents": 1850}'
\`\`\`

**Step 4: Check balance from your POS**

Look up the gift card to display the balance before charging:

\`\`\`bash
curl https://your-domain.com/api/v1/passes/PASS_ID \\
  -H "Authorization: Bearer lsk_live_..."
\`\`\`

The \`data.data.balanceCents\` field shows the current balance. Your POS can display this to the cashier before processing the transaction.

**Step 5: Track gift card revenue**

Use webhooks to sync gift card activity with your accounting system:

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/webhooks \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-pos.example.com/webhooks/loyalshy",
    "events": ["pass.issued", "interaction.created"]
  }'
\`\`\`

Filter \`interaction.created\` events by type — \`GIFT_CHARGE\` for sales, \`GIFT_REFUND\` for returns — to keep your ledger in sync.`,
    },
    servers: [
      {
        url: "/api/v1",
        description: "Current server",
      },
    ],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Contacts", description: "Manage contacts — the end users who receive and carry wallet passes. Contacts are scoped to your organization and identified by name, email, or phone." },
      { name: "Templates", description: "View pass templates (programs). Templates define the blueprint for a type of pass — e.g., \"Coffee Stamp Card\" or \"VIP Membership\". Templates are read-only via the API; create and edit them in the dashboard." },
      {
        name: "Passes",
        description: "Issue and manage pass instances. A pass instance links a contact to a template — it represents an issued wallet pass with type-specific state (stamps collected, points balance, etc.).",
      },
      { name: "Interactions", description: "Record and query interactions. Every event on a pass (stamp, check-in, points earn, ticket scan, etc.) is recorded as an interaction with a discriminated type." },
      { name: "Stats", description: "Organization-level and template-level aggregate statistics." },
      {
        name: "Webhooks",
        description: `Manage webhook endpoints for real-time event delivery. Webhooks are signed with HMAC-SHA256 and delivered with automatic retries.

## Setting Up Webhooks

### Step 1: Create an endpoint

Register a publicly accessible HTTPS URL. The signing secret is returned **once** — save it.

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/webhooks \\
  -H "Authorization: Bearer lsk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-app.com/webhooks/loyalshy",
    "events": ["contact.created", "pass.issued", "interaction.created"]
  }'
\`\`\`

Response (save the \`secret\`):
\`\`\`json
{
  "data": {
    "id": "whep_...",
    "url": "https://your-app.com/webhooks/loyalshy",
    "secret": "whsec_abc123...",
    "events": ["contact.created", "pass.issued", "interaction.created"],
    "enabled": true
  }
}
\`\`\`

### Step 2: Build your handler

Your endpoint must respond with a \`2xx\` status within 30 seconds. Here's a minimal Express handler:

\`\`\`javascript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.post('/webhooks/loyalshy', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['loyalshy-signature'];
  const payload = req.body.toString();

  // Verify signature (see below)
  try {
    verifyWebhook(payload, signature, process.env.WEBHOOK_SECRET);
  } catch (e) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(payload);
  console.log('Event:', event.type, event.id);

  // Handle the event
  switch (event.type) {
    case 'contact.created':
      // Sync to your CRM
      break;
    case 'interaction.created':
      // Update analytics
      break;
  }

  res.status(200).json({ received: true });
});
\`\`\`

### Step 3: Send a test event

Verify everything works before going live:

\`\`\`bash
curl -X POST https://your-domain.com/api/v1/webhooks/ENDPOINT_ID/test \\
  -H "Authorization: Bearer lsk_live_..."
\`\`\`

Check your server logs for a \`test.ping\` event.

---

## Signature Verification

Every delivery includes a \`Loyalshy-Signature\` header with a timestamp and HMAC-SHA256 signature:

\`\`\`
Loyalshy-Signature: t=1710000000,v1=5257a869e7ecebeda32af...
\`\`\`

**Why verify?** Without verification, anyone could POST fake events to your endpoint. The signature proves the payload came from Loyalshy and wasn't tampered with.

\`\`\`javascript
import crypto from 'crypto';

function verifyWebhook(payload, header, secret) {
  const [tPart, vPart] = header.split(',');
  const timestamp = tPart.split('=')[1];
  const signature = vPart.split('=')[1];

  // 1. Reject replays older than 5 minutes
  if (Date.now() / 1000 - parseInt(timestamp) > 300) {
    throw new Error('Timestamp too old — possible replay attack');
  }

  // 2. Compute expected signature
  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${timestamp}.\${payload}\`)
    .digest('hex');

  // 3. Compare using constant-time comparison
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid signature');
  }
}
\`\`\`

**Python equivalent:**

\`\`\`python
import hmac, hashlib, time

def verify_webhook(payload: str, header: str, secret: str):
    t_part, v_part = header.split(",")
    timestamp = t_part.split("=")[1]
    signature = v_part.split("=")[1]

    if time.time() - int(timestamp) > 300:
        raise ValueError("Timestamp too old")

    expected = hmac.new(
        secret.encode(), f"{timestamp}.{payload}".encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid signature")
\`\`\`

---

## Webhook Payload Format

Every delivery POSTs a JSON body with this structure (see the **WebhookPayload** schema for full details):

\`\`\`json
{
  "id": "evt_a1b2c3d4...",
  "api_version": "2026-03-01",
  "type": "contact.created",
  "created_at": "2026-03-10T14:30:00.000Z",
  "organization_id": "org_...",
  "data": {
    "contact": { "id": "...", "fullName": "Jane Smith", ... }
  }
}
\`\`\`

The \`data\` field shape depends on the event type:

| Event pattern | \`data\` contains |
|---------------|-----------------|
| \`contact.*\` | \`{ contact: Contact }\` (or \`{ contactId }\` for deletes) |
| \`pass.*\` | \`{ pass: PassInstance }\` |
| \`interaction.created\` | \`{ interaction: Interaction }\` |
| \`reward.*\` | \`{ reward: Reward }\` |
| \`test.ping\` | \`{ message, timestamp }\` |

---

## Event Types

| Event | Trigger |
|-------|---------|
| \`contact.created\` | New contact created |
| \`contact.updated\` | Contact details updated |
| \`contact.deleted\` | Contact soft-deleted |
| \`pass.issued\` | Pass issued to a contact |
| \`pass.completed\` | Pass reached completion (e.g., stamp card full) |
| \`pass.suspended\` | Pass suspended |
| \`pass.revoked\` | Pass revoked |
| \`interaction.created\` | New interaction recorded |
| \`reward.earned\` | Contact earned a reward |
| \`reward.redeemed\` | Reward redeemed |
| \`test.ping\` | Manual test event |

## Retry Policy

Failed deliveries (non-2xx response or timeout) are retried up to **5 times** with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | ~5 seconds |
| 3 | ~25 seconds |
| 4 | ~2 minutes |
| 5 | ~5 minutes |

After 10 consecutive failures across any deliveries, the endpoint is **auto-disabled**. Re-enable it via \`PATCH /webhooks/{id}\` with \`{ "enabled": true }\` — this resets the failure counter.

## Best Practices

- **Respond quickly** — return \`200\` immediately and process asynchronously. Deliveries time out after 30 seconds.
- **Handle duplicates** — use the \`id\` field to deduplicate. In rare cases, the same event may be delivered twice.
- **Verify signatures** — always verify the HMAC signature before trusting the payload.
- **Monitor failures** — check the endpoint detail (\`GET /webhooks/{id}\`) for recent delivery statuses. High failure counts mean your endpoint may be auto-disabled soon.
- **Rotate secrets periodically** — use \`POST /webhooks/{id}/rotate-secret\` and update your handler before the old secret stops working.`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http" as const,
          scheme: "bearer",
          description: "API key prefixed with `lsk_live_`. Created in Settings → API.",
        },
      },
      schemas: {
        // ─── Error ────────────────────────────────────────────
        Error: {
          type: "object" as const,
          required: ["status", "title"],
          properties: {
            status: { type: "integer" as const, description: "HTTP status code", example: 422 },
            title: { type: "string" as const, description: "Short human-readable error type", example: "Validation Error" },
            detail: { type: "string" as const, description: "Longer explanation of what went wrong", example: "Request body failed validation." },
            errors: {
              type: "array" as const,
              description: "Field-level validation errors (present on 422 responses)",
              items: {
                type: "object" as const,
                properties: {
                  field: { type: "string" as const, description: "JSON path to the invalid field", example: "fullName" },
                  message: { type: "string" as const, description: "Validation failure reason", example: "Required" },
                },
              },
            },
          },
        },
        // ─── Pagination ───────────────────────────────────────
        Pagination: {
          type: "object" as const,
          description: "Pagination metadata included on list responses",
          properties: {
            page: { type: "integer" as const, description: "Current page number (1-indexed)", example: 1 },
            perPage: { type: "integer" as const, description: "Items per page", example: 20 },
            total: { type: "integer" as const, description: "Total items matching the query", example: 142 },
            pageCount: { type: "integer" as const, description: "Total number of pages", example: 8 },
          },
        },
        // ─── Contact ──────────────────────────────────────────
        Contact: {
          type: "object" as const,
          description: "A contact (end user) in your organization",
          properties: {
            id: { type: "string" as const, description: "Unique identifier (UUIDv7)", example: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" },
            fullName: { type: "string" as const, description: "Display name", example: "Jane Smith" },
            email: { type: "string" as const, nullable: true, description: "Email address (unique per org if set)", example: "jane@example.com" },
            phone: { type: "string" as const, nullable: true, description: "Phone number (unique per org if set)", example: "+1234567890" },
            memberNumber: { type: "integer" as const, description: "Sequential member number within your organization", example: 42 },
            totalInteractions: { type: "integer" as const, description: "Lifetime interaction count across all passes", example: 15 },
            lastInteractionAt: { type: "string" as const, format: "date-time", nullable: true, description: "Timestamp of most recent interaction", example: "2026-03-10T14:30:00.000Z" },
            passInstanceCount: { type: "integer" as const, description: "Number of active pass instances", example: 2 },
            metadata: { type: "object" as const, description: "Arbitrary key-value pairs for custom data", example: { source: "csv_import", tier: "gold" } },
            createdAt: { type: "string" as const, format: "date-time", description: "When the contact was created", example: "2026-01-15T09:00:00.000Z" },
          },
        },
        // ─── Contact Detail ───────────────────────────────────
        ContactDetail: {
          allOf: [
            { $ref: "#/components/schemas/Contact" },
            {
              type: "object" as const,
              properties: {
                passInstances: {
                  type: "array" as const,
                  description: "All pass instances for this contact",
                  items: { $ref: "#/components/schemas/PassInstanceSummary" },
                },
                recentInteractions: {
                  type: "array" as const,
                  description: "Most recent interactions (up to 20)",
                  items: { $ref: "#/components/schemas/InteractionSummary" },
                },
                rewards: {
                  type: "array" as const,
                  description: "Earned rewards",
                  items: { $ref: "#/components/schemas/RewardSummary" },
                },
              },
            },
          ],
        },
        // ─── Template ─────────────────────────────────────────
        Template: {
          type: "object" as const,
          description: "A pass template (program blueprint)",
          properties: {
            id: { type: "string" as const, description: "Unique identifier (UUIDv7)", example: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" },
            name: { type: "string" as const, description: "Template name", example: "Coffee Stamp Card" },
            description: { type: "string" as const, nullable: true, description: "Optional description", example: "Collect 10 stamps, get a free drink" },
            passType: {
              type: "string" as const,
              enum: ["STAMP_CARD", "COUPON", "MEMBERSHIP", "POINTS", "PREPAID", "GIFT_CARD", "TICKET", "ACCESS", "TRANSIT", "BUSINESS_ID"],
              description: "Type of wallet pass",
              example: "STAMP_CARD",
            },
            status: {
              type: "string" as const,
              enum: ["DRAFT", "ACTIVE", "ARCHIVED"],
              description: "Template lifecycle status",
              example: "ACTIVE",
            },
            config: { type: "object" as const, description: "Type-specific configuration (stamps required, point multiplier, etc.)" },
            startsAt: { type: "string" as const, format: "date-time", description: "When the template becomes active", example: "2026-01-01T00:00:00.000Z" },
            endsAt: { type: "string" as const, format: "date-time", nullable: true, description: "Optional expiry date", example: null },
            passInstanceCount: { type: "integer" as const, description: "Number of issued pass instances", example: 350 },
            createdAt: { type: "string" as const, format: "date-time", description: "When the template was created", example: "2025-12-20T10:00:00.000Z" },
          },
        },
        // ─── Template Detail ──────────────────────────────────
        TemplateDetail: {
          allOf: [
            { $ref: "#/components/schemas/Template" },
            {
              type: "object" as const,
              properties: {
                termsAndConditions: { type: "string" as const, nullable: true, description: "Terms displayed on the pass" },
                stats: {
                  type: "object" as const,
                  description: "Aggregate statistics for this template",
                  properties: {
                    activeInstances: { type: "integer" as const, description: "Currently active pass instances", example: 280 },
                    totalInteractions: { type: "integer" as const, description: "Total interactions across all instances", example: 4350 },
                    availableRewards: { type: "integer" as const, description: "Unclaimed rewards", example: 12 },
                    redeemedRewards: { type: "integer" as const, description: "Redeemed rewards", example: 45 },
                  },
                },
              },
            },
          ],
        },
        // ─── Pass Instance ────────────────────────────────────
        PassInstance: {
          type: "object" as const,
          description: "An issued pass instance linking a contact to a template",
          properties: {
            id: { type: "string" as const, description: "Unique identifier (UUIDv7)", example: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" },
            contactId: { type: "string" as const, description: "ID of the contact who owns this pass" },
            templateId: { type: "string" as const, description: "ID of the pass template" },
            templateName: { type: "string" as const, description: "Name of the pass template", example: "Coffee Stamp Card" },
            passType: {
              type: "string" as const,
              enum: ["STAMP_CARD", "COUPON", "MEMBERSHIP", "POINTS", "PREPAID", "GIFT_CARD", "TICKET", "ACCESS", "TRANSIT", "BUSINESS_ID"],
              description: "Pass type (inherited from template)",
              example: "STAMP_CARD",
            },
            status: {
              type: "string" as const,
              enum: ["ACTIVE", "COMPLETED", "SUSPENDED", "EXPIRED", "REVOKED", "VOIDED"],
              description: "Current pass status",
              example: "ACTIVE",
            },
            data: {
              type: "object" as const,
              description: "Type-specific state (e.g., `{ stampsCollected: 7 }` for stamp cards, `{ pointsBalance: 500 }` for points)",
              example: { stampsCollected: 7 },
            },
            walletProvider: { type: "string" as const, description: "Wallet platform", example: "NONE", enum: ["NONE", "APPLE", "GOOGLE"] },
            issuedAt: { type: "string" as const, format: "date-time", description: "When the pass was issued", example: "2026-02-01T12:00:00.000Z" },
            expiresAt: { type: "string" as const, format: "date-time", nullable: true, description: "Optional expiry date", example: null },
            createdAt: { type: "string" as const, format: "date-time", description: "Record creation timestamp", example: "2026-02-01T12:00:00.000Z" },
          },
        },
        // ─── Pass Instance Detail ─────────────────────────────
        PassInstanceDetail: {
          allOf: [
            { $ref: "#/components/schemas/PassInstance" },
            {
              type: "object" as const,
              properties: {
                contact: {
                  type: "object" as const,
                  description: "Embedded contact summary",
                  properties: {
                    id: { type: "string" as const },
                    fullName: { type: "string" as const, example: "Jane Smith" },
                    email: { type: "string" as const, nullable: true, example: "jane@example.com" },
                  },
                },
                recentInteractions: {
                  type: "array" as const,
                  description: "Most recent interactions on this pass",
                  items: { $ref: "#/components/schemas/InteractionSummary" },
                },
                walletUrls: {
                  type: "object" as const,
                  nullable: true,
                  description: "Signed URLs for wallet pass download and card view. Included in POST /passes responses.",
                  properties: {
                    cardUrl: { type: "string" as const, description: "Browser-viewable card URL with HMAC signature" },
                    appleWalletUrl: { type: "string" as const, nullable: true, description: "Direct .pkpass download URL (R2-hosted). Null if Apple pass not yet generated." },
                    googleWalletUrl: { type: "string" as const, description: "Signed Google Wallet download URL" },
                  },
                },
                emailSent: {
                  type: "boolean" as const,
                  description: "Whether the pass-issued email was sent. Only present in POST /passes responses when sendEmail was true.",
                },
              },
            },
          ],
        },
        // ─── Pass Instance Summary ────────────────────────────
        PassInstanceSummary: {
          type: "object" as const,
          description: "Compact pass instance (used in contact detail)",
          properties: {
            id: { type: "string" as const },
            templateId: { type: "string" as const },
            templateName: { type: "string" as const, example: "Coffee Stamp Card" },
            passType: { type: "string" as const, example: "STAMP_CARD" },
            status: { type: "string" as const, example: "ACTIVE" },
            data: { type: "object" as const },
            walletProvider: { type: "string" as const, example: "APPLE" },
            issuedAt: { type: "string" as const, format: "date-time" },
            expiresAt: { type: "string" as const, format: "date-time", nullable: true },
          },
        },
        // ─── Interaction ──────────────────────────────────────
        Interaction: {
          type: "object" as const,
          description: "An event recorded on a pass instance",
          properties: {
            id: { type: "string" as const, description: "Unique identifier (UUIDv7)", example: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" },
            type: {
              type: "string" as const,
              description: "Interaction type discriminator",
              enum: ["STAMP", "COUPON_REDEEM", "CHECK_IN", "POINTS_EARN", "POINTS_REDEEM", "PREPAID_USE", "PREPAID_RECHARGE", "GIFT_CHARGE", "GIFT_REFUND", "TICKET_SCAN", "TICKET_VOID", "ACCESS_GRANT", "ACCESS_DENY", "TRANSIT_BOARD", "TRANSIT_EXIT", "ID_VERIFY", "STATUS_CHANGE", "REWARD_EARNED", "REWARD_REDEEMED", "NOTE"],
              example: "STAMP",
            },
            metadata: { type: "object" as const, description: "Type-specific metadata", example: { stampNumber: 7 } },
            createdAt: { type: "string" as const, format: "date-time", description: "When the interaction occurred", example: "2026-03-10T14:30:00.000Z" },
            pass: {
              type: "object" as const,
              nullable: true,
              description: "Linked pass instance (null if pass was deleted)",
              properties: {
                id: { type: "string" as const },
                templateName: { type: "string" as const, example: "Coffee Stamp Card" },
                passType: { type: "string" as const, example: "STAMP_CARD" },
                status: { type: "string" as const, example: "ACTIVE" },
              },
            },
            contact: {
              type: "object" as const,
              description: "Contact who owns the pass",
              properties: {
                id: { type: "string" as const },
                fullName: { type: "string" as const, example: "Jane Smith" },
              },
            },
          },
        },
        // ─── Interaction Summary ──────────────────────────────
        InteractionSummary: {
          type: "object" as const,
          description: "Compact interaction (used in detail views)",
          properties: {
            id: { type: "string" as const },
            type: { type: "string" as const, example: "STAMP" },
            createdAt: { type: "string" as const, format: "date-time" },
            templateName: { type: "string" as const, example: "Coffee Stamp Card" },
            passType: { type: "string" as const, example: "STAMP_CARD" },
          },
        },
        // ─── Reward Summary ───────────────────────────────────
        RewardSummary: {
          type: "object" as const,
          description: "A reward earned by a contact",
          properties: {
            id: { type: "string" as const },
            status: { type: "string" as const, example: "AVAILABLE" },
            description: { type: "string" as const, nullable: true, example: "Free coffee" },
            earnedAt: { type: "string" as const, format: "date-time" },
            redeemedAt: { type: "string" as const, format: "date-time", nullable: true },
            expiresAt: { type: "string" as const, format: "date-time" },
          },
        },
        // ─── Action Result ────────────────────────────────────
        ActionResult: {
          type: "object" as const,
          description: "Result of performing a type-specific action on a pass",
          properties: {
            action: { type: "string" as const, description: "The action that was performed", example: "stamp" },
            passInstanceId: { type: "string" as const, description: "ID of the affected pass instance" },
            result: {
              type: "object" as const,
              description: "Action-specific result data (e.g., new stamp count, updated balance)",
              example: { stampsCollected: 8, stampsRequired: 10, completed: false },
            },
            interaction: {
              type: "object" as const,
              description: "The interaction record created by this action",
              properties: {
                id: { type: "string" as const },
                type: { type: "string" as const, example: "STAMP" },
                createdAt: { type: "string" as const, format: "date-time" },
              },
            },
          },
        },
        // ─── Webhook Endpoint ─────────────────────────────────
        WebhookEndpoint: {
          type: "object" as const,
          description: "A webhook endpoint that receives event deliveries",
          properties: {
            id: { type: "string" as const, description: "Unique identifier", example: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" },
            url: { type: "string" as const, format: "uri", description: "HTTPS URL that receives POST requests", example: "https://example.com/webhooks/loyalshy" },
            events: {
              type: "array" as const,
              description: "Event types this endpoint is subscribed to",
              items: { type: "string" as const },
              example: ["contact.created", "pass.issued", "interaction.created"],
            },
            enabled: { type: "boolean" as const, description: "Whether deliveries are active", example: true },
            failureCount: { type: "integer" as const, description: "Consecutive delivery failures (resets on success or manual re-enable). Auto-disables at 10.", example: 0 },
            lastDeliveryAt: { type: "string" as const, format: "date-time", nullable: true, description: "Timestamp of most recent delivery attempt" },
            createdAt: { type: "string" as const, format: "date-time", description: "When the endpoint was created" },
          },
        },
        // ─── Webhook Endpoint with Secret ─────────────────────
        WebhookEndpointWithSecret: {
          allOf: [
            { $ref: "#/components/schemas/WebhookEndpoint" },
            {
              type: "object" as const,
              properties: {
                secret: { type: "string" as const, description: "HMAC-SHA256 signing secret. Only returned on create and rotate — store it securely.", example: "whsec_abc123..." },
              },
            },
          ],
        },
        // ─── Webhook Delivery ─────────────────────────────────
        WebhookDelivery: {
          type: "object" as const,
          description: "A single webhook delivery attempt",
          properties: {
            id: { type: "string" as const },
            eventType: { type: "string" as const, example: "contact.created" },
            statusCode: { type: "integer" as const, nullable: true, description: "HTTP response status from your endpoint", example: 200 },
            success: { type: "boolean" as const, example: true },
            attempts: { type: "integer" as const, description: "Number of delivery attempts (max 5)", example: 1 },
            createdAt: { type: "string" as const, format: "date-time" },
          },
        },
        // ─── Bulk Result ──────────────────────────────────────
        BulkResult: {
          type: "object" as const,
          description: "Result of a bulk operation",
          properties: {
            created: { type: "integer" as const, description: "Successfully created count", example: 45 },
            skipped: { type: "integer" as const, description: "Skipped (e.g., duplicates)", example: 3 },
            errors: { type: "integer" as const, description: "Failed count", example: 2 },
            items: {
              type: "array" as const,
              description: "Per-item results",
              items: {
                type: "object" as const,
                properties: {
                  index: { type: "integer" as const },
                  status: { type: "string" as const, enum: ["created", "skipped", "error"] },
                  id: { type: "string" as const, nullable: true },
                  error: { type: "string" as const, nullable: true },
                },
              },
            },
          },
        },
        // ─── Org Stats ────────────────────────────────────────
        OrgStats: {
          type: "object" as const,
          description: "Organization-level aggregate statistics",
          properties: {
            totalContacts: { type: "integer" as const, example: 1250 },
            totalPassInstances: { type: "integer" as const, example: 3400 },
            activePassInstances: { type: "integer" as const, example: 2800 },
            totalInteractions: { type: "integer" as const, example: 15600 },
            totalRewards: { type: "integer" as const, example: 320 },
            redeemedRewards: { type: "integer" as const, example: 180 },
          },
        },
        // ─── Daily Stats ──────────────────────────────────────
        DailyStats: {
          type: "object" as const,
          description: "Statistics for a single day",
          properties: {
            date: { type: "string" as const, format: "date", example: "2026-03-10" },
            newContacts: { type: "integer" as const, example: 12 },
            newPassInstances: { type: "integer" as const, example: 25 },
            interactions: { type: "integer" as const, example: 85 },
            rewardsEarned: { type: "integer" as const, example: 5 },
          },
        },
        // ─── Template Stats ───────────────────────────────────
        TemplateStats: {
          type: "object" as const,
          description: "Per-template statistics",
          properties: {
            activeInstances: { type: "integer" as const, example: 280 },
            totalInteractions: { type: "integer" as const, example: 4350 },
            availableRewards: { type: "integer" as const, example: 12 },
            redeemedRewards: { type: "integer" as const, example: 45 },
          },
        },
        // ─── Webhook Payload ──────────────────────────────────
        WebhookPayload: {
          type: "object" as const,
          description: "The JSON body delivered to your webhook endpoint via POST. Signed with HMAC-SHA256.",
          required: ["id", "api_version", "type", "created_at", "organization_id", "data"],
          properties: {
            id: { type: "string" as const, description: "Unique event ID (prefixed with `evt_`)", example: "evt_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6" },
            api_version: { type: "string" as const, description: "API version that generated the event", example: "2026-03-01" },
            type: {
              type: "string" as const,
              description: "Event type",
              enum: ["contact.created", "contact.updated", "contact.deleted", "pass.issued", "pass.completed", "pass.suspended", "pass.revoked", "pass.expired", "pass.voided", "interaction.created", "reward.earned", "reward.redeemed", "reward.expired", "test.ping"],
              example: "contact.created",
            },
            created_at: { type: "string" as const, format: "date-time", description: "When the event was generated", example: "2026-03-10T14:30:00.000Z" },
            organization_id: { type: "string" as const, description: "Organization that owns the resource" },
            data: {
              type: "object" as const,
              description: "Event-specific payload. Shape depends on the event type — see examples below.",
            },
          },
          examples: {
            "contact.created": {
              value: {
                id: "evt_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
                api_version: "2026-03-01",
                type: "contact.created",
                created_at: "2026-03-10T14:30:00.000Z",
                organization_id: "0190a1b2-org",
                data: {
                  contact: {
                    id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                    fullName: "Jane Smith",
                    email: "jane@example.com",
                    phone: null,
                    memberNumber: 42,
                    totalInteractions: 0,
                    lastInteractionAt: null,
                    passInstanceCount: 0,
                    metadata: {},
                    createdAt: "2026-03-10T14:30:00.000Z",
                  },
                },
              },
            },
            "contact.deleted": {
              value: {
                id: "evt_f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3",
                api_version: "2026-03-01",
                type: "contact.deleted",
                created_at: "2026-03-10T15:00:00.000Z",
                organization_id: "0190a1b2-org",
                data: { contactId: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" },
              },
            },
            "pass.issued": {
              value: {
                id: "evt_b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1",
                api_version: "2026-03-01",
                type: "pass.issued",
                created_at: "2026-03-10T14:31:00.000Z",
                organization_id: "0190a1b2-org",
                data: {
                  pass: {
                    id: "0190a1b2-pass",
                    contactId: "0190a1b2-contact",
                    templateId: "0190a1b2-template",
                    templateName: "Coffee Stamp Card",
                    passType: "STAMP_CARD",
                    status: "ACTIVE",
                    data: { stampsCollected: 0 },
                    walletProvider: "NONE",
                    issuedAt: "2026-03-10T14:31:00.000Z",
                    expiresAt: null,
                    createdAt: "2026-03-10T14:31:00.000Z",
                  },
                },
              },
            },
            "interaction.created": {
              value: {
                id: "evt_c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1b2",
                api_version: "2026-03-01",
                type: "interaction.created",
                created_at: "2026-03-10T14:32:00.000Z",
                organization_id: "0190a1b2-org",
                data: {
                  interaction: {
                    id: "0190a1b2-interaction",
                    type: "STAMP",
                    metadata: { stampNumber: 7 },
                    createdAt: "2026-03-10T14:32:00.000Z",
                    pass: { id: "0190a1b2-pass", templateName: "Coffee Stamp Card", passType: "STAMP_CARD", status: "ACTIVE" },
                    contact: { id: "0190a1b2-contact", fullName: "Jane Smith" },
                  },
                },
              },
            },
            "test.ping": {
              value: {
                id: "evt_d4e5f6a7b8c9d0e1f2a3b4c5d6a1b2c3",
                api_version: "2026-03-01",
                type: "test.ping",
                created_at: "2026-03-10T14:33:00.000Z",
                organization_id: "0190a1b2-org",
                data: {
                  message: "This is a test webhook event from Loyalshy.",
                  timestamp: "2026-03-10T14:33:00.000Z",
                },
              },
            },
          },
        },
      },
    },
    paths: {
      // ─── Contacts ───────────────────────────────────────
      "/contacts": {
        get: {
          tags: ["Contacts"],
          summary: "List contacts",
          operationId: "listContacts",
          description: "Returns a paginated list of contacts for your organization.",
          parameters: [
            { name: "page", in: "query", description: "Page number (1-indexed)", schema: { type: "integer", default: 1, minimum: 1 } },
            { name: "per_page", in: "query", description: "Items per page (max 100)", schema: { type: "integer", default: 20, minimum: 1, maximum: 100 } },
            { name: "search", in: "query", description: "Full-text search across name, email, and phone", schema: { type: "string" } },
            { name: "sort", in: "query", description: "Sort field", schema: { type: "string", enum: ["fullName", "createdAt", "totalInteractions", "lastInteractionAt"], default: "createdAt" } },
            { name: "order", in: "query", description: "Sort direction", schema: { type: "string", enum: ["asc", "desc"], default: "desc" } },
            { name: "pass_type", in: "query", description: "Filter to contacts with at least one pass of this type", schema: { type: "string", enum: ["STAMP_CARD", "COUPON", "MEMBERSHIP", "POINTS", "PREPAID", "GIFT_CARD", "TICKET", "ACCESS", "TRANSIT", "BUSINESS_ID"] } },
          ],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl https://api.loyalshy.com/api/v1/contacts?search=jane&page=1 \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/contacts?search=jane&page=1\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data, meta } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Paginated list of contacts",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: { type: "array", items: { $ref: "#/components/schemas/Contact" } },
                      meta: {
                        type: "object",
                        properties: {
                          requestId: { type: "string" },
                          pagination: { $ref: "#/components/schemas/Pagination" },
                        },
                      },
                    },
                  },
                  example: {
                    data: [
                      {
                        id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                        fullName: "Jane Smith",
                        email: "jane@example.com",
                        phone: null,
                        memberNumber: 42,
                        totalInteractions: 15,
                        lastInteractionAt: "2026-03-10T14:30:00.000Z",
                        passInstanceCount: 2,
                        metadata: {},
                        createdAt: "2026-01-15T09:00:00.000Z",
                      },
                    ],
                    meta: { requestId: "req_01HZ3KFGP4NXJ", pagination: { page: 1, perPage: 20, total: 142, pageCount: 8 } },
                  },
                },
              },
            },
            "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: 401, title: "Unauthorized", detail: "Missing or invalid API key." } } } },
            "429": { description: "Rate limited. Check `Retry-After` header for seconds until reset.", headers: { "Retry-After": { description: "Seconds to wait before retrying", schema: { type: "integer", example: 30 } } }, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: 429, title: "Too Many Requests", detail: "Rate limit exceeded. Retry after 30 seconds." } } } },
          },
        },
        post: {
          tags: ["Contacts"],
          summary: "Create a contact",
          operationId: "createContact",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["fullName"],
                  properties: {
                    fullName: { type: "string", maxLength: 100, description: "Display name (required)" },
                    email: { type: "string", format: "email", description: "Email address (unique per org)" },
                    phone: { type: "string", description: "Phone number (unique per org)" },
                    metadata: { type: "object", description: "Arbitrary key-value pairs" },
                  },
                },
                example: { fullName: "Jane Smith", email: "jane@example.com", metadata: { source: "api" } },
              },
            },
          },
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl -X POST https://api.loyalshy.com/api/v1/contacts \\\n  -H \"Authorization: Bearer lsk_live_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"fullName\":\"Jane Smith\",\"email\":\"jane@example.com\",\"metadata\":{\"source\":\"api\"}}'",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\"https://api.loyalshy.com/api/v1/contacts\", {\n  method: \"POST\",\n  headers: { Authorization: \"Bearer lsk_live_...\", \"Content-Type\": \"application/json\" },\n  body: JSON.stringify({ fullName: \"Jane Smith\", email: \"jane@example.com\", metadata: { source: \"api\" } }),\n});\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "201": {
              description: "Contact created",
              content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Contact" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } }, example: { data: { id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b", fullName: "Jane Smith", email: "jane@example.com", phone: null, memberNumber: 42, totalInteractions: 0, lastInteractionAt: null, passInstanceCount: 0, metadata: { source: "api" }, createdAt: "2026-03-10T14:30:00.000Z" }, meta: { requestId: "req_01HZ3KFGP4NXJ" } } } },
            },
            "409": { description: "Duplicate email or phone", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: 409, title: "Conflict", detail: "A contact with this email already exists." } } } },
            "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: 422, title: "Validation Error", detail: "Request body failed validation.", errors: [{ field: "fullName", message: "Required" }] } } } },
          },
        },
      },
      "/contacts/{id}": {
        get: {
          tags: ["Contacts"],
          summary: "Get contact detail",
          operationId: "getContact",
          description: "Returns full contact detail including pass instances, recent interactions, and rewards.",
          parameters: [{ name: "id", in: "path", required: true, description: "Contact ID", schema: { type: "string" } }],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl https://api.loyalshy.com/api/v1/contacts/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/contacts/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Contact detail",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/ContactDetail" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: {
                      id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                      fullName: "Jane Smith",
                      email: "jane@example.com",
                      phone: null,
                      memberNumber: 42,
                      totalInteractions: 15,
                      lastInteractionAt: "2026-03-10T14:30:00.000Z",
                      passInstanceCount: 1,
                      metadata: { source: "csv_import", tier: "gold" },
                      createdAt: "2026-01-15T09:00:00.000Z",
                      passInstances: [
                        {
                          id: "0190a1b2-d4e5-7f6a-9b0c-1d2e3f4a5b6c",
                          templateId: "0190a1b2-e5f6-7a8b-0c1d-2e3f4a5b6c7d",
                          templateName: "Coffee Stamp Card",
                          passType: "STAMP_CARD",
                          status: "ACTIVE",
                          data: { stampsCollected: 7 },
                          walletProvider: "APPLE",
                          issuedAt: "2026-02-01T12:00:00.000Z",
                          expiresAt: null,
                        },
                      ],
                      recentInteractions: [
                        {
                          id: "0190a1b2-f6a7-7b8c-1d2e-3f4a5b6c7d8e",
                          type: "STAMP",
                          createdAt: "2026-03-10T14:30:00.000Z",
                          templateName: "Coffee Stamp Card",
                          passType: "STAMP_CARD",
                        },
                      ],
                      rewards: [
                        {
                          id: "0190a1b2-a7b8-7c9d-2e3f-4a5b6c7d8e9f",
                          status: "AVAILABLE",
                          description: "Free coffee",
                          earnedAt: "2026-03-05T10:00:00.000Z",
                          redeemedAt: null,
                          expiresAt: "2026-06-05T10:00:00.000Z",
                        },
                      ],
                    },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: 404, title: "Not Found", detail: "Contact not found." } } } },
          },
        },
        patch: {
          tags: ["Contacts"],
          summary: "Update a contact",
          operationId: "updateContact",
          description: "Update one or more fields on a contact. Only provided fields are changed.",
          parameters: [{ name: "id", in: "path", required: true, description: "Contact ID", schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    fullName: { type: "string", maxLength: 100 },
                    email: { type: "string", nullable: true, description: "Set to null to remove" },
                    phone: { type: "string", nullable: true, description: "Set to null to remove" },
                    metadata: { type: "object", description: "Replaces existing metadata entirely" },
                  },
                },
                example: { fullName: "Jane Doe", metadata: { tier: "platinum" } },
              },
            },
          },
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl -X PATCH https://api.loyalshy.com/api/v1/contacts/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b \\\n  -H \"Authorization: Bearer lsk_live_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"fullName\":\"Jane Doe\",\"metadata\":{\"tier\":\"platinum\"}}'",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/contacts/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b\",\n  {\n    method: \"PATCH\",\n    headers: { Authorization: \"Bearer lsk_live_...\", \"Content-Type\": \"application/json\" },\n    body: JSON.stringify({ fullName: \"Jane Doe\", metadata: { tier: \"platinum\" } }),\n  }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Updated contact",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Contact" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: {
                      id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                      fullName: "Jane Doe",
                      email: "jane@example.com",
                      phone: null,
                      memberNumber: 42,
                      totalInteractions: 15,
                      lastInteractionAt: "2026-03-10T14:30:00.000Z",
                      passInstanceCount: 1,
                      metadata: { tier: "platinum" },
                      createdAt: "2026-01-15T09:00:00.000Z",
                    },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "409": { description: "Duplicate email or phone", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        delete: {
          tags: ["Contacts"],
          summary: "Delete a contact",
          operationId: "deleteContact",
          description: "Soft-deletes the contact. Pass instances and interactions are preserved for reporting.",
          parameters: [{ name: "id", in: "path", required: true, description: "Contact ID", schema: { type: "string" } }],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl -X DELETE https://api.loyalshy.com/api/v1/contacts/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "await fetch(\n  \"https://api.loyalshy.com/api/v1/contacts/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b\",\n  { method: \"DELETE\", headers: { Authorization: \"Bearer lsk_live_...\" } }\n);",
            },
          ],
          responses: {
            "204": { description: "Successfully deleted" },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/contacts/bulk": {
        post: {
          tags: ["Contacts"],
          summary: "Bulk import contacts",
          operationId: "bulkCreateContacts",
          description: "Create up to 200 contacts at once. If `issueTemplateId` is provided, a pass is automatically issued to each new contact (limit reduced to 100).",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["contacts"],
                  properties: {
                    contacts: {
                      type: "array",
                      maxItems: 200,
                      description: "Array of contacts to create",
                      items: {
                        type: "object",
                        required: ["fullName"],
                        properties: {
                          fullName: { type: "string" },
                          email: { type: "string", format: "email" },
                          phone: { type: "string" },
                          metadata: { type: "object" },
                        },
                      },
                    },
                    issueTemplateId: { type: "string", description: "Optionally issue a pass from this template to each new contact (reduces limit to 100)" },
                  },
                },
                example: {
                  contacts: [
                    { fullName: "Alice Johnson", email: "alice@example.com" },
                    { fullName: "Bob Williams", phone: "+1987654321" },
                  ],
                  issueTemplateId: "0190a1b2-c3d4-7e5f-8a9b-template1234",
                },
              },
            },
          },
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl -X POST https://api.loyalshy.com/api/v1/contacts/bulk \\\n  -H \"Authorization: Bearer lsk_live_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"contacts\":[{\"fullName\":\"Alice Johnson\",\"email\":\"alice@example.com\"},{\"fullName\":\"Bob Williams\",\"phone\":\"+1987654321\"}],\"issueTemplateId\":\"0190a1b2-template\"}'",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\"https://api.loyalshy.com/api/v1/contacts/bulk\", {\n  method: \"POST\",\n  headers: { Authorization: \"Bearer lsk_live_...\", \"Content-Type\": \"application/json\" },\n  body: JSON.stringify({\n    contacts: [{ fullName: \"Alice Johnson\", email: \"alice@example.com\" }],\n    issueTemplateId: \"0190a1b2-template\",\n  }),\n});\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "201": {
              description: "Bulk result",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/BulkResult" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: { data: { created: 2, skipped: 0, errors: 0, items: [{ index: 0, status: "created", id: "0190a1b2-...", error: null }, { index: 1, status: "created", id: "0190a1b3-...", error: null }] }, meta: { requestId: "req_01HZ3KFGP4NXJ" } },
                },
              },
            },
            "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ─── Templates ──────────────────────────────────────
      "/templates": {
        get: {
          tags: ["Templates"],
          summary: "List templates",
          operationId: "listTemplates",
          description: "Returns a paginated list of pass templates. Templates are read-only via the API.",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
            { name: "per_page", in: "query", schema: { type: "integer", default: 20, minimum: 1, maximum: 100 } },
            { name: "status", in: "query", description: "Filter by template status", schema: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] } },
            { name: "pass_type", in: "query", description: "Filter by pass type", schema: { type: "string", enum: ["STAMP_CARD", "COUPON", "MEMBERSHIP", "POINTS", "PREPAID", "GIFT_CARD", "TICKET", "ACCESS", "TRANSIT", "BUSINESS_ID"] } },
          ],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl \"https://api.loyalshy.com/api/v1/templates?status=ACTIVE&pass_type=STAMP_CARD\" \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/templates?status=ACTIVE&pass_type=STAMP_CARD\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data, meta } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Paginated list of templates",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Template" } }, meta: { type: "object", properties: { requestId: { type: "string" }, pagination: { $ref: "#/components/schemas/Pagination" } } } } },
                  example: {
                    data: [
                      {
                        id: "0190a1b2-e5f6-7a8b-0c1d-2e3f4a5b6c7d",
                        name: "Coffee Stamp Card",
                        description: "Collect 10 stamps, get a free drink",
                        passType: "STAMP_CARD",
                        status: "ACTIVE",
                        config: { stampsRequired: 10, rewardDescription: "Free coffee" },
                        startsAt: "2026-01-01T00:00:00.000Z",
                        endsAt: null,
                        passInstanceCount: 350,
                        createdAt: "2025-12-20T10:00:00.000Z",
                      },
                    ],
                    meta: { requestId: "req_01HZ3KFGP4NXJ", pagination: { page: 1, perPage: 20, total: 4, pageCount: 1 } },
                  },
                },
              },
            },
          },
        },
      },
      "/templates/{id}": {
        get: {
          tags: ["Templates"],
          summary: "Get template detail",
          operationId: "getTemplate",
          description: "Returns full template detail including terms and aggregate statistics.",
          parameters: [{ name: "id", in: "path", required: true, description: "Template ID", schema: { type: "string" } }],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl https://api.loyalshy.com/api/v1/templates/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/templates/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Template detail",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/TemplateDetail" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: {
                      id: "0190a1b2-e5f6-7a8b-0c1d-2e3f4a5b6c7d",
                      name: "Coffee Stamp Card",
                      description: "Collect 10 stamps, get a free drink",
                      passType: "STAMP_CARD",
                      status: "ACTIVE",
                      config: { stampsRequired: 10, rewardDescription: "Free coffee" },
                      startsAt: "2026-01-01T00:00:00.000Z",
                      endsAt: null,
                      passInstanceCount: 350,
                      createdAt: "2025-12-20T10:00:00.000Z",
                      termsAndConditions: "One reward per customer per visit. Not transferable.",
                      stats: {
                        activeInstances: 280,
                        totalInteractions: 4350,
                        availableRewards: 12,
                        redeemedRewards: 45,
                      },
                    },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/templates/{id}/stats": {
        get: {
          tags: ["Templates"],
          summary: "Get template statistics",
          operationId: "getTemplateStats",
          description: "Returns aggregate statistics for a specific template.",
          parameters: [{ name: "id", in: "path", required: true, description: "Template ID", schema: { type: "string" } }],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl https://api.loyalshy.com/api/v1/templates/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/stats \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/templates/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/stats\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Template statistics",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/TemplateStats" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: {
                      activeInstances: 280,
                      totalInteractions: 4350,
                      availableRewards: 12,
                      redeemedRewards: 45,
                    },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ─── Passes ─────────────────────────────────────────
      "/passes": {
        get: {
          tags: ["Passes"],
          summary: "List pass instances",
          operationId: "listPasses",
          description: "Returns a paginated list of issued pass instances, optionally filtered by contact, template, status, or type.",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
            { name: "per_page", in: "query", schema: { type: "integer", default: 20, minimum: 1, maximum: 100 } },
            { name: "contact_id", in: "query", description: "Filter by contact", schema: { type: "string" } },
            { name: "template_id", in: "query", description: "Filter by template", schema: { type: "string" } },
            { name: "status", in: "query", description: "Filter by pass status", schema: { type: "string", enum: ["ACTIVE", "COMPLETED", "SUSPENDED", "EXPIRED", "REVOKED", "VOIDED"] } },
            { name: "pass_type", in: "query", description: "Filter by pass type", schema: { type: "string", enum: ["STAMP_CARD", "COUPON", "MEMBERSHIP", "POINTS", "PREPAID", "GIFT_CARD", "TICKET", "ACCESS", "TRANSIT", "BUSINESS_ID"] } },
          ],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl \"https://api.loyalshy.com/api/v1/passes?status=ACTIVE&pass_type=STAMP_CARD&page=1\" \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/passes?status=ACTIVE&pass_type=STAMP_CARD\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data, meta } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Paginated list of pass instances",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/PassInstance" } }, meta: { type: "object", properties: { requestId: { type: "string" }, pagination: { $ref: "#/components/schemas/Pagination" } } } } },
                  example: {
                    data: [
                      {
                        id: "0190a1b2-d4e5-7f6a-9b0c-1d2e3f4a5b6c",
                        contactId: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                        templateId: "0190a1b2-e5f6-7a8b-0c1d-2e3f4a5b6c7d",
                        templateName: "Coffee Stamp Card",
                        passType: "STAMP_CARD",
                        status: "ACTIVE",
                        data: { stampsCollected: 7 },
                        walletProvider: "APPLE",
                        issuedAt: "2026-02-01T12:00:00.000Z",
                        expiresAt: null,
                        createdAt: "2026-02-01T12:00:00.000Z",
                      },
                    ],
                    meta: { requestId: "req_01HZ3KFGP4NXJ", pagination: { page: 1, perPage: 20, total: 350, pageCount: 18 } },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Passes"],
          summary: "Issue a pass",
          operationId: "issuePass",
          description: "Issue a pass from an active template to a contact. You can provide an existing `contactId` or create a contact inline via the `contact` object (at least one is required). Set `sendEmail: true` to send the pass-issued email with wallet download links. The response always includes `walletUrls` with signed URLs for embedding in your own emails.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["templateId"],
                  properties: {
                    templateId: { type: "string", description: "ID of an active pass template" },
                    contactId: { type: "string", description: "ID of an existing contact. Required if `contact` is not provided." },
                    contact: {
                      type: "object",
                      description: "Inline contact creation. If a contact with the same email or phone already exists, the existing contact is used. Required if `contactId` is not provided.",
                      required: ["fullName"],
                      properties: {
                        fullName: { type: "string", description: "Contact's full name", maxLength: 100 },
                        email: { type: "string", format: "email", description: "Contact's email address", maxLength: 255 },
                        phone: { type: "string", description: "Contact's phone number", maxLength: 30 },
                      },
                    },
                    sendEmail: { type: "boolean", default: false, description: "Send the pass-issued email with wallet download links to the contact's email address." },
                  },
                },
                examples: {
                  "with-contact-id": {
                    summary: "Issue to existing contact",
                    value: { templateId: "0190a1b2-template", contactId: "0190a1b2-contact" },
                  },
                  "with-inline-contact": {
                    summary: "Create contact + issue pass + send email",
                    value: {
                      templateId: "0190a1b2-template",
                      contact: { fullName: "Jane Doe", email: "jane@example.com", phone: "+1234567890" },
                      sendEmail: true,
                    },
                  },
                  "venue-ticketing": {
                    summary: "Venue ticketing — issue ticket on booking confirmation",
                    description: "Typical integration for venues: when a customer completes a booking, call this endpoint to create the contact, issue the event ticket, and send the confirmation email with Apple/Google Wallet links — all in a single API call. Use the returned `walletUrls` to embed download buttons in your own confirmation page or email.",
                    value: {
                      templateId: "0190a1b2-event-ticket-template",
                      contact: {
                        fullName: "Maria Garcia",
                        email: "maria.garcia@example.com",
                        phone: "+34612345678",
                      },
                      sendEmail: true,
                    },
                  },
                },
              },
            },
          },
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL — existing contact",
              source: "curl -X POST https://api.loyalshy.com/api/v1/passes \\\n  -H \"Authorization: Bearer lsk_live_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"templateId\":\"0190a1b2-template\",\"contactId\":\"0190a1b2-contact\"}'",
            },
            {
              lang: "curl",
              label: "cURL — inline contact + email",
              source: "curl -X POST https://api.loyalshy.com/api/v1/passes \\\n  -H \"Authorization: Bearer lsk_live_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"templateId\":\"0190a1b2-template\",\"contact\":{\"fullName\":\"Jane Doe\",\"email\":\"jane@example.com\"},\"sendEmail\":true}'",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\"https://api.loyalshy.com/api/v1/passes\", {\n  method: \"POST\",\n  headers: { Authorization: \"Bearer lsk_live_...\", \"Content-Type\": \"application/json\" },\n  body: JSON.stringify({\n    templateId: \"0190a1b2-template\",\n    contact: { fullName: \"Jane Doe\", email: \"jane@example.com\" },\n    sendEmail: true,\n  }),\n});\nconst { data } = await res.json();\nconsole.log(data.walletUrls);",
            },
            {
              lang: "javascript",
              label: "Venue ticketing integration",
              source: "// After a customer completes a booking, issue the ticket\n// and embed wallet links in your confirmation page\nasync function onBookingConfirmed(booking) {\n  const res = await fetch(\"https://api.loyalshy.com/api/v1/passes\", {\n    method: \"POST\",\n    headers: {\n      Authorization: `Bearer ${process.env.LOYALSHY_API_KEY}`,\n      \"Content-Type\": \"application/json\",\n      \"Idempotency-Key\": `booking-${booking.id}`,\n    },\n    body: JSON.stringify({\n      templateId: TICKET_TEMPLATE_ID,\n      contact: {\n        fullName: booking.customerName,\n        email: booking.customerEmail,\n        phone: booking.customerPhone,\n      },\n      // Loyalshy sends the pass email with wallet buttons\n      sendEmail: true,\n    }),\n  });\n\n  const { data: pass } = await res.json();\n\n  // Also embed wallet links in your own confirmation page\n  return {\n    passId: pass.id,\n    cardUrl: pass.walletUrls.cardUrl,\n    appleWalletUrl: pass.walletUrls.appleWalletUrl,\n    googleWalletUrl: pass.walletUrls.googleWalletUrl,\n  };\n}",
            },
          ],
          responses: {
            "201": {
              description: "Pass issued",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/PassInstanceDetail" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: {
                      id: "0190a1b2-d4e5-7f6a-9b0c-1d2e3f4a5b6c",
                      contactId: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                      templateId: "0190a1b2-e5f6-7a8b-0c1d-2e3f4a5b6c7d",
                      templateName: "Jazz Night VIP",
                      passType: "TICKET",
                      status: "ACTIVE",
                      data: { scanCount: 0 },
                      walletProvider: "NONE",
                      issuedAt: "2026-03-12T14:30:00.000Z",
                      expiresAt: null,
                      createdAt: "2026-03-12T14:30:00.000Z",
                      contact: { id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b", fullName: "Jane Doe", email: "jane@example.com" },
                      recentInteractions: [],
                      walletUrls: {
                        cardUrl: "https://loyalshy.com/join/venue-slug/card/0190a1b2-d4e5?sig=...",
                        appleWalletUrl: null,
                        googleWalletUrl: "https://loyalshy.com/api/wallet/download/0190a1b2-d4e5?sig=...&platform=google",
                      },
                      emailSent: true,
                    },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "404": { description: "Contact or template not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "409": { description: "Contact already has a pass for this template", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: 409, title: "Conflict", detail: "Contact already has an active pass for this template." } } } },
            "422": { description: "Validation error or template not active", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: 422, title: "Validation Error", detail: "Either contactId or contact is required." } } } },
          },
        },
      },
      "/passes/{id}": {
        get: {
          tags: ["Passes"],
          summary: "Get pass instance detail",
          operationId: "getPass",
          description: "Returns full pass instance detail including the contact and recent interactions.",
          parameters: [{ name: "id", in: "path", required: true, description: "Pass instance ID", schema: { type: "string" } }],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl https://api.loyalshy.com/api/v1/passes/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/passes/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Pass instance detail",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/PassInstanceDetail" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: {
                      id: "0190a1b2-d4e5-7f6a-9b0c-1d2e3f4a5b6c",
                      contactId: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                      templateId: "0190a1b2-e5f6-7a8b-0c1d-2e3f4a5b6c7d",
                      templateName: "Coffee Stamp Card",
                      passType: "STAMP_CARD",
                      status: "ACTIVE",
                      data: { stampsCollected: 7 },
                      walletProvider: "APPLE",
                      issuedAt: "2026-02-01T12:00:00.000Z",
                      expiresAt: null,
                      createdAt: "2026-02-01T12:00:00.000Z",
                      contact: {
                        id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                        fullName: "Jane Smith",
                        email: "jane@example.com",
                      },
                      recentInteractions: [
                        {
                          id: "0190a1b2-f6a7-7b8c-1d2e-3f4a5b6c7d8e",
                          type: "STAMP",
                          createdAt: "2026-03-10T14:30:00.000Z",
                          templateName: "Coffee Stamp Card",
                          passType: "STAMP_CARD",
                        },
                      ],
                    },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/passes/{id}/actions": {
        post: {
          tags: ["Passes"],
          summary: "Perform a type-specific action",
          operationId: "performAction",
          description:
            "Execute an action on a pass instance. The action must match the pass type:\n\n" +
            "| Pass Type | Actions |\n|---|---|\n" +
            "| STAMP_CARD | `stamp` |\n| COUPON | `redeem` |\n| MEMBERSHIP | `check_in` |\n" +
            "| POINTS | `earn_points`, `redeem_points` |\n| PREPAID | `use`, `recharge` |\n" +
            "| GIFT_CARD | `charge`, `refund` |\n| TICKET | `scan`, `void` |\n" +
            "| ACCESS | `grant`, `deny` |\n| TRANSIT | `board`, `exit` |\n| BUSINESS_ID | `verify` |",
          parameters: [{ name: "id", in: "path", required: true, description: "Pass instance ID", schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      title: "Simple action",
                      description: "Actions with no extra parameters",
                      required: ["action"],
                      properties: { action: { type: "string", enum: ["stamp", "check_in", "scan", "void", "grant", "deny", "board", "exit", "verify"] } },
                    },
                    {
                      type: "object",
                      title: "Redeem coupon",
                      required: ["action"],
                      properties: { action: { const: "redeem" }, value: { type: "string", description: "Optional redemption value override" } },
                    },
                    {
                      type: "object",
                      title: "Points action",
                      required: ["action", "points"],
                      properties: { action: { type: "string", enum: ["earn_points", "redeem_points"] }, points: { type: "integer", minimum: 1, description: "Number of points to earn or redeem" } },
                    },
                    {
                      type: "object",
                      title: "Prepaid use",
                      required: ["action", "amount"],
                      properties: { action: { const: "use" }, amount: { type: "integer", minimum: 1, description: "Number of uses to consume" } },
                    },
                    {
                      type: "object",
                      title: "Prepaid recharge",
                      required: ["action", "uses"],
                      properties: { action: { const: "recharge" }, uses: { type: "integer", minimum: 1, description: "Number of uses to add" } },
                    },
                    {
                      type: "object",
                      title: "Gift card charge/refund",
                      required: ["action", "amountCents"],
                      properties: { action: { type: "string", enum: ["charge", "refund"] }, amountCents: { type: "integer", minimum: 1, description: "Amount in cents" } },
                    },
                  ],
                  discriminator: { propertyName: "action" },
                },
                examples: {
                  stamp: { summary: "Add a stamp", value: { action: "stamp" } },
                  earn_points: { summary: "Earn 100 points", value: { action: "earn_points", points: 100 } },
                  charge: { summary: "Charge $15 from gift card", value: { action: "charge", amountCents: 1500 } },
                  redeem: { summary: "Redeem a coupon", value: { action: "redeem" } },
                  check_in: { summary: "Check in membership", value: { action: "check_in" } },
                },
              },
            },
          },
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl -X POST https://api.loyalshy.com/api/v1/passes/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/actions \\\n  -H \"Authorization: Bearer lsk_live_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"action\":\"stamp\"}'",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/passes/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/actions\",\n  {\n    method: \"POST\",\n    headers: { Authorization: \"Bearer lsk_live_...\", \"Content-Type\": \"application/json\" },\n    body: JSON.stringify({ action: \"stamp\" }),\n  }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "201": {
              description: "Action performed successfully",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/ActionResult" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  examples: {
                    stamp: {
                      summary: "Stamp added",
                      value: { data: { action: "stamp", passInstanceId: "0190a1b2-...", result: { stampsCollected: 8, stampsRequired: 10, completed: false }, interaction: { id: "0190a1b2-...", type: "STAMP", createdAt: "2026-03-10T14:30:00.000Z" } }, meta: { requestId: "req_01HZ3K" } },
                    },
                    earn_points: {
                      summary: "Points earned",
                      value: { data: { action: "earn_points", passInstanceId: "0190a1b2-...", result: { pointsEarned: 100, pointsBalance: 750, lifetimePoints: 2500 }, interaction: { id: "0190a1b3-...", type: "POINTS_EARN", createdAt: "2026-03-10T14:31:00.000Z" } }, meta: { requestId: "req_01HZ3L" } },
                    },
                  },
                },
              },
            },
            "404": { description: "Pass not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "422": {
              description: "Invalid action or pass not active",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                  examples: {
                    wrong_type: { summary: "Action doesn't match pass type", value: { status: 422, title: "Validation Error", detail: "Action 'stamp' is not valid for pass type POINTS." } },
                    not_active: { summary: "Pass is not active", value: { status: 422, title: "Validation Error", detail: "Pass is not active." } },
                    insufficient: { summary: "Insufficient balance", value: { status: 422, title: "Validation Error", detail: "Insufficient points balance." } },
                  },
                },
              },
            },
          },
        },
      },
      "/passes/{id}/interactions": {
        get: {
          tags: ["Passes"],
          summary: "List interactions for a pass",
          operationId: "listPassInteractions",
          description: "Returns a paginated list of interactions for a specific pass instance.",
          parameters: [
            { name: "id", in: "path", required: true, description: "Pass instance ID", schema: { type: "string" } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "per_page", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "type", in: "query", description: "Filter by interaction type", schema: { type: "string" } },
          ],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl \"https://api.loyalshy.com/api/v1/passes/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/interactions?type=STAMP\" \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/passes/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/interactions?type=STAMP\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data, meta } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Paginated interactions",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Interaction" } }, meta: { type: "object", properties: { requestId: { type: "string" }, pagination: { $ref: "#/components/schemas/Pagination" } } } } },
                  example: {
                    data: [
                      {
                        id: "0190a1b2-f6a7-7b8c-1d2e-3f4a5b6c7d8e",
                        type: "STAMP",
                        metadata: { stampNumber: 7 },
                        createdAt: "2026-03-10T14:30:00.000Z",
                        pass: {
                          id: "0190a1b2-d4e5-7f6a-9b0c-1d2e3f4a5b6c",
                          templateName: "Coffee Stamp Card",
                          passType: "STAMP_CARD",
                          status: "ACTIVE",
                        },
                        contact: {
                          id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                          fullName: "Jane Smith",
                        },
                      },
                    ],
                    meta: { requestId: "req_01HZ3KFGP4NXJ", pagination: { page: 1, perPage: 20, total: 7, pageCount: 1 } },
                  },
                },
              },
            },
            "404": { description: "Pass not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          tags: ["Passes"],
          summary: "Create an interaction",
          operationId: "createInteraction",
          description: "Create a raw interaction record on an active pass. For type-specific actions with business logic (stamping, earning points, etc.), use the `/passes/{id}/actions` endpoint instead.",
          parameters: [{ name: "id", in: "path", required: true, description: "Pass instance ID", schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["type"],
                  properties: {
                    type: {
                      type: "string",
                      enum: ["STAMP", "COUPON_REDEEM", "CHECK_IN", "POINTS_EARN", "POINTS_REDEEM", "PREPAID_USE", "PREPAID_RECHARGE", "GIFT_CHARGE", "GIFT_REFUND", "TICKET_SCAN", "TICKET_VOID", "ACCESS_GRANT", "ACCESS_DENY", "TRANSIT_BOARD", "TRANSIT_EXIT", "ID_VERIFY", "STATUS_CHANGE", "REWARD_EARNED", "REWARD_REDEEMED", "NOTE"],
                      description: "Interaction type",
                    },
                    metadata: { type: "object", description: "Arbitrary metadata for the interaction" },
                  },
                },
                example: { type: "NOTE", metadata: { note: "Customer called about their membership" } },
              },
            },
          },
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl -X POST https://api.loyalshy.com/api/v1/passes/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/interactions \\\n  -H \"Authorization: Bearer lsk_live_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"type\":\"NOTE\",\"metadata\":{\"note\":\"Customer called about their membership\"}}'",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/passes/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/interactions\",\n  {\n    method: \"POST\",\n    headers: { Authorization: \"Bearer lsk_live_...\", \"Content-Type\": \"application/json\" },\n    body: JSON.stringify({ type: \"NOTE\", metadata: { note: \"Customer called about their membership\" } }),\n  }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "201": {
              description: "Interaction created",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Interaction" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: {
                      id: "0190a1b2-f6a7-7b8c-1d2e-3f4a5b6c7d8e",
                      type: "NOTE",
                      metadata: { note: "Customer called about their membership" },
                      createdAt: "2026-03-10T14:30:00.000Z",
                      pass: {
                        id: "0190a1b2-d4e5-7f6a-9b0c-1d2e3f4a5b6c",
                        templateName: "Coffee Stamp Card",
                        passType: "STAMP_CARD",
                        status: "ACTIVE",
                      },
                      contact: {
                        id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                        fullName: "Jane Smith",
                      },
                    },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "404": { description: "Pass not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "422": { description: "Pass not active", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: 422, title: "Validation Error", detail: "Pass is not active." } } } },
          },
        },
      },
      "/passes/bulk": {
        post: {
          tags: ["Passes"],
          summary: "Bulk issue passes",
          operationId: "bulkIssuePasses",
          description: "Issue passes from a single template to up to 100 contacts at once. Contacts that already have a pass for the template are skipped.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["templateId", "contactIds"],
                  properties: {
                    templateId: { type: "string", description: "ID of an active pass template" },
                    contactIds: { type: "array", maxItems: 100, description: "Array of contact IDs", items: { type: "string" } },
                  },
                },
                example: { templateId: "0190a1b2-template", contactIds: ["0190a1b2-contact1", "0190a1b2-contact2"] },
              },
            },
          },
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl -X POST https://api.loyalshy.com/api/v1/passes/bulk \\\n  -H \"Authorization: Bearer lsk_live_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"templateId\":\"0190a1b2-template\",\"contactIds\":[\"0190a1b2-contact1\",\"0190a1b2-contact2\"]}'",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\"https://api.loyalshy.com/api/v1/passes/bulk\", {\n  method: \"POST\",\n  headers: { Authorization: \"Bearer lsk_live_...\", \"Content-Type\": \"application/json\" },\n  body: JSON.stringify({\n    templateId: \"0190a1b2-template\",\n    contactIds: [\"0190a1b2-contact1\", \"0190a1b2-contact2\"],\n  }),\n});\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "201": {
              description: "Bulk result",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/BulkResult" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: {
                      created: 2,
                      skipped: 1,
                      errors: 0,
                      items: [
                        { index: 0, status: "created", id: "0190a1b2-d4e5-7f6a-9b0c-1d2e3f4a5b6c", error: null },
                        { index: 1, status: "skipped", id: null, error: null },
                        { index: 2, status: "created", id: "0190a1b2-d5e6-7a8b-0c1d-2e3f4a5b6c7d", error: null },
                      ],
                    },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "422": { description: "Validation error or template not active", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ─── Interactions ───────────────────────────────────
      "/interactions": {
        get: {
          tags: ["Interactions"],
          summary: "List all interactions",
          operationId: "listInteractions",
          description: "Cross-pass interaction listing with filters. Returns interactions across all passes in your organization.",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "per_page", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "type", in: "query", description: "Filter by interaction type", schema: { type: "string" } },
            { name: "contact_id", in: "query", description: "Filter by contact", schema: { type: "string" } },
            { name: "template_id", in: "query", description: "Filter by template", schema: { type: "string" } },
            { name: "since", in: "query", description: "Only interactions after this timestamp", schema: { type: "string", format: "date-time" } },
            { name: "until", in: "query", description: "Only interactions before this timestamp", schema: { type: "string", format: "date-time" } },
          ],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl \"https://api.loyalshy.com/api/v1/interactions?type=STAMP&since=2026-03-01T00:00:00Z\" \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/interactions?type=STAMP&since=2026-03-01T00:00:00Z\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data, meta } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Paginated interactions",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Interaction" } }, meta: { type: "object", properties: { requestId: { type: "string" }, pagination: { $ref: "#/components/schemas/Pagination" } } } } },
                  example: {
                    data: [
                      {
                        id: "0190a1b2-f6a7-7b8c-1d2e-3f4a5b6c7d8e",
                        type: "STAMP",
                        metadata: { stampNumber: 7 },
                        createdAt: "2026-03-10T14:30:00.000Z",
                        pass: {
                          id: "0190a1b2-d4e5-7f6a-9b0c-1d2e3f4a5b6c",
                          templateName: "Coffee Stamp Card",
                          passType: "STAMP_CARD",
                          status: "ACTIVE",
                        },
                        contact: {
                          id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                          fullName: "Jane Smith",
                        },
                      },
                    ],
                    meta: { requestId: "req_01HZ3KFGP4NXJ", pagination: { page: 1, perPage: 20, total: 4350, pageCount: 218 } },
                  },
                },
              },
            },
          },
        },
      },
      "/interactions/{id}": {
        get: {
          tags: ["Interactions"],
          summary: "Get interaction detail",
          operationId: "getInteraction",
          parameters: [{ name: "id", in: "path", required: true, description: "Interaction ID", schema: { type: "string" } }],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl https://api.loyalshy.com/api/v1/interactions/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/interactions/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Interaction detail",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Interaction" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: {
                      id: "0190a1b2-f6a7-7b8c-1d2e-3f4a5b6c7d8e",
                      type: "STAMP",
                      metadata: { stampNumber: 7 },
                      createdAt: "2026-03-10T14:30:00.000Z",
                      pass: {
                        id: "0190a1b2-d4e5-7f6a-9b0c-1d2e3f4a5b6c",
                        templateName: "Coffee Stamp Card",
                        passType: "STAMP_CARD",
                        status: "ACTIVE",
                      },
                      contact: {
                        id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                        fullName: "Jane Smith",
                      },
                    },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ─── Stats ──────────────────────────────────────────
      "/stats": {
        get: {
          tags: ["Stats"],
          summary: "Organization statistics",
          operationId: "getOrgStats",
          description: "Returns aggregate statistics for your organization including total contacts, passes, interactions, and rewards.",
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl https://api.loyalshy.com/api/v1/stats \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/stats\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Organization statistics",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/OrgStats" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: { data: { totalContacts: 1250, totalPassInstances: 3400, activePassInstances: 2800, totalInteractions: 15600, totalRewards: 320, redeemedRewards: 180 }, meta: { requestId: "req_01HZ3K" } },
                },
              },
            },
          },
        },
      },
      "/stats/daily": {
        get: {
          tags: ["Stats"],
          summary: "Daily statistics time series",
          operationId: "getDailyStats",
          description: "Returns daily statistics for a date range. Maximum range is 90 days.",
          parameters: [
            { name: "from", in: "query", required: true, description: "Start date (YYYY-MM-DD)", schema: { type: "string", format: "date" }, example: "2026-03-01" },
            { name: "to", in: "query", required: true, description: "End date (YYYY-MM-DD), inclusive. Max 90-day range.", schema: { type: "string", format: "date" }, example: "2026-03-10" },
          ],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl \"https://api.loyalshy.com/api/v1/stats/daily?from=2026-03-01&to=2026-03-10\" \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/stats/daily?from=2026-03-01&to=2026-03-10\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Daily stats array",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/DailyStats" } }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: { data: [{ date: "2026-03-10", newContacts: 12, newPassInstances: 25, interactions: 85, rewardsEarned: 5 }], meta: { requestId: "req_01HZ3K" } },
                },
              },
            },
            "422": { description: "Invalid date range or exceeds 90-day limit", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: 422, title: "Validation Error", detail: "Date range exceeds 90-day maximum." } } } },
          },
        },
      },

      // ─── Webhooks ───────────────────────────────────────
      "/webhooks": {
        get: {
          tags: ["Webhooks"],
          summary: "List webhook endpoints",
          operationId: "listWebhooks",
          description: "Returns all webhook endpoints for your organization. Secrets are not included in the response.",
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl https://api.loyalshy.com/api/v1/webhooks \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/webhooks\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "List of webhook endpoints",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/WebhookEndpoint" } }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: [
                      {
                        id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                        url: "https://example.com/webhooks/loyalshy",
                        events: ["contact.created", "pass.issued", "interaction.created"],
                        enabled: true,
                        failureCount: 0,
                        lastDeliveryAt: "2026-03-10T14:30:00.000Z",
                        createdAt: "2026-01-15T09:00:00.000Z",
                      },
                    ],
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Webhooks"],
          summary: "Create a webhook endpoint",
          operationId: "createWebhook",
          description: "Register a new webhook endpoint. The signing secret is returned **once** in the response — store it securely. The URL must be HTTPS and cannot point to private IP ranges.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url", "events"],
                  properties: {
                    url: { type: "string", format: "uri", description: "HTTPS URL to receive webhook POST requests" },
                    events: {
                      type: "array",
                      minItems: 1,
                      description: "Event types to subscribe to",
                      items: { type: "string", enum: ["contact.created", "contact.updated", "contact.deleted", "pass.issued", "pass.completed", "pass.suspended", "pass.revoked", "interaction.created", "reward.earned", "reward.redeemed"] },
                    },
                    enabled: { type: "boolean", default: true, description: "Whether the endpoint starts active" },
                  },
                },
                example: { url: "https://example.com/webhooks/loyalshy", events: ["contact.created", "pass.issued", "interaction.created"] },
              },
            },
          },
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl -X POST https://api.loyalshy.com/api/v1/webhooks \\\n  -H \"Authorization: Bearer lsk_live_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"url\":\"https://example.com/webhooks/loyalshy\",\"events\":[\"contact.created\",\"pass.issued\",\"interaction.created\"]}'",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\"https://api.loyalshy.com/api/v1/webhooks\", {\n  method: \"POST\",\n  headers: { Authorization: \"Bearer lsk_live_...\", \"Content-Type\": \"application/json\" },\n  body: JSON.stringify({\n    url: \"https://example.com/webhooks/loyalshy\",\n    events: [\"contact.created\", \"pass.issued\", \"interaction.created\"],\n  }),\n});\nconst { data } = await res.json(); // data.secret — store immediately",
            },
          ],
          responses: {
            "201": {
              description: "Endpoint created with signing secret",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/WebhookEndpointWithSecret" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: {
                      id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                      url: "https://example.com/webhooks/loyalshy",
                      events: ["contact.created", "pass.issued", "interaction.created"],
                      enabled: true,
                      failureCount: 0,
                      lastDeliveryAt: null,
                      createdAt: "2026-03-10T14:30:00.000Z",
                      secret: "whsec_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
                    },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "422": { description: "Validation error (e.g., non-HTTPS URL, private IP)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/webhooks/{id}": {
        get: {
          tags: ["Webhooks"],
          summary: "Get webhook endpoint detail",
          operationId: "getWebhook",
          description: "Returns endpoint details including the 25 most recent delivery attempts.",
          parameters: [{ name: "id", in: "path", required: true, description: "Webhook endpoint ID", schema: { type: "string" } }],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl https://api.loyalshy.com/api/v1/webhooks/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/webhooks/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b\",\n  { headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Endpoint detail with recent deliveries",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        allOf: [
                          { $ref: "#/components/schemas/WebhookEndpoint" },
                          {
                            type: "object",
                            properties: {
                              recentDeliveries: { type: "array", description: "25 most recent delivery attempts", items: { $ref: "#/components/schemas/WebhookDelivery" } },
                            },
                          },
                        ],
                      },
                      meta: { type: "object", properties: { requestId: { type: "string" } } },
                    },
                  },
                  example: {
                    data: {
                      id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                      url: "https://example.com/webhooks/loyalshy",
                      events: ["contact.created", "pass.issued", "interaction.created"],
                      enabled: true,
                      failureCount: 0,
                      lastDeliveryAt: "2026-03-10T14:30:00.000Z",
                      createdAt: "2026-01-15T09:00:00.000Z",
                      recentDeliveries: [
                        {
                          id: "0190a1b2-a7b8-7c9d-2e3f-4a5b6c7d8e9f",
                          eventType: "contact.created",
                          statusCode: 200,
                          success: true,
                          attempts: 1,
                          createdAt: "2026-03-10T14:30:00.000Z",
                        },
                      ],
                    },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        patch: {
          tags: ["Webhooks"],
          summary: "Update a webhook endpoint",
          operationId: "updateWebhook",
          description: "Update endpoint URL, events, or enabled state. Re-enabling an endpoint resets the failure counter.",
          parameters: [{ name: "id", in: "path", required: true, description: "Webhook endpoint ID", schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", format: "uri", description: "New HTTPS URL" },
                    events: { type: "array", items: { type: "string", enum: ["contact.created", "contact.updated", "contact.deleted", "pass.issued", "pass.completed", "pass.suspended", "pass.revoked", "interaction.created", "reward.earned", "reward.redeemed"] } },
                    enabled: { type: "boolean", description: "Set to true to re-enable (resets failure counter)" },
                  },
                },
              },
            },
          },
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl -X PATCH https://api.loyalshy.com/api/v1/webhooks/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b \\\n  -H \"Authorization: Bearer lsk_live_...\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"enabled\":true,\"events\":[\"contact.created\",\"pass.issued\"]}'",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/webhooks/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b\",\n  {\n    method: \"PATCH\",\n    headers: { Authorization: \"Bearer lsk_live_...\", \"Content-Type\": \"application/json\" },\n    body: JSON.stringify({ enabled: true, events: [\"contact.created\", \"pass.issued\"] }),\n  }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Updated endpoint",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { $ref: "#/components/schemas/WebhookEndpoint" }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: {
                      id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
                      url: "https://example.com/webhooks/loyalshy",
                      events: ["contact.created", "pass.issued"],
                      enabled: true,
                      failureCount: 0,
                      lastDeliveryAt: "2026-03-10T14:30:00.000Z",
                      createdAt: "2026-01-15T09:00:00.000Z",
                    },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        delete: {
          tags: ["Webhooks"],
          summary: "Delete a webhook endpoint",
          operationId: "deleteWebhook",
          description: "Permanently deletes the webhook endpoint and all associated delivery records.",
          parameters: [{ name: "id", in: "path", required: true, description: "Webhook endpoint ID", schema: { type: "string" } }],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl -X DELETE https://api.loyalshy.com/api/v1/webhooks/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "await fetch(\n  \"https://api.loyalshy.com/api/v1/webhooks/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b\",\n  { method: \"DELETE\", headers: { Authorization: \"Bearer lsk_live_...\" } }\n);",
            },
          ],
          responses: {
            "204": { description: "Successfully deleted" },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/webhooks/{id}/test": {
        post: {
          tags: ["Webhooks"],
          summary: "Send a test event",
          operationId: "testWebhook",
          description: "Sends a `test.ping` event to the endpoint. Use this to verify your webhook handler is working correctly.",
          parameters: [{ name: "id", in: "path", required: true, description: "Webhook endpoint ID", schema: { type: "string" } }],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl -X POST https://api.loyalshy.com/api/v1/webhooks/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/test \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/webhooks/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/test\",\n  { method: \"POST\", headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data } = await res.json();",
            },
          ],
          responses: {
            "200": {
              description: "Test event dispatched",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { type: "object", properties: { message: { type: "string", example: "Test event dispatched" } } }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: { message: "Test event dispatched" },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/webhooks/{id}/rotate-secret": {
        post: {
          tags: ["Webhooks"],
          summary: "Rotate signing secret",
          operationId: "rotateWebhookSecret",
          description: "Generates a new HMAC-SHA256 signing secret. The new secret is returned **once** — update your webhook handler immediately. Also resets the failure counter.",
          parameters: [{ name: "id", in: "path", required: true, description: "Webhook endpoint ID", schema: { type: "string" } }],
          "x-codeSamples": [
            {
              lang: "curl",
              label: "cURL",
              source: "curl -X POST https://api.loyalshy.com/api/v1/webhooks/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/rotate-secret \\\n  -H \"Authorization: Bearer lsk_live_...\"",
            },
            {
              lang: "javascript",
              label: "Node.js",
              source: "const res = await fetch(\n  \"https://api.loyalshy.com/api/v1/webhooks/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b/rotate-secret\",\n  { method: \"POST\", headers: { Authorization: \"Bearer lsk_live_...\" } }\n);\nconst { data } = await res.json(); // data.secret — store immediately",
            },
          ],
          responses: {
            "200": {
              description: "New secret generated",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { data: { type: "object", properties: { secret: { type: "string", description: "New signing secret", example: "whsec_new123..." } } }, meta: { type: "object", properties: { requestId: { type: "string" } } } } },
                  example: {
                    data: { secret: "whsec_b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3" },
                    meta: { requestId: "req_01HZ3KFGP4NXJ" },
                  },
                },
              },
            },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
    },
  }
}
