import type { Metadata } from "next"
import Link from "next/link"

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com"

export const metadata: Metadata = {
  title: "Privacy Policy — Loyalshy",
  description: "How Loyalshy collects, uses, and protects your personal data.",
  alternates: { canonical: `${siteUrl}/privacy` },
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--mk-bg, #fafafa)" }}>
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <header className="mb-12">
          <Link
            href="/"
            className="text-[14px] font-medium mb-6 inline-block transition-opacity hover:opacity-70"
            style={{ color: "var(--mk-text-muted, #666)" }}
          >
            &larr; Back to Loyalshy
          </Link>
          <h1
            className="text-3xl sm:text-4xl font-bold"
            style={{ color: "var(--mk-text, #111)", letterSpacing: "-0.03em" }}
          >
            Privacy Policy
          </h1>
          <p className="mt-3 text-[15px]" style={{ color: "var(--mk-text-muted, #666)" }}>
            Last updated: March 2026
          </p>
        </header>

        <article
          className="prose prose-sm max-w-none space-y-8 text-[15px] leading-relaxed"
          style={{ color: "var(--mk-text-muted, #444)" }}
        >
          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>1. Who We Are</h2>
            <p>
              Loyalshy (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates a digital wallet pass platform at loyalshy.com.
              We help businesses create and manage Apple Wallet and Google Wallet passes for loyalty programs,
              memberships, coupons, tickets, and more.
            </p>
            <p>For privacy inquiries, contact us at <a href="mailto:hello@loyalshy.com" className="underline">hello@loyalshy.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>2. Data We Collect</h2>
            <p><strong>Account data:</strong> When you register, we collect your name, email address, and password (hashed). If you create an organization, we store business name and branding assets.</p>
            <p><strong>Contact data:</strong> Businesses using our platform may add contacts (their customers) with names, email addresses, and phone numbers to issue digital passes.</p>
            <p><strong>Usage data:</strong> We collect anonymized page views via Plausible Analytics, which does not use cookies and does not track personal data.</p>
            <p><strong>Payment data:</strong> Payment processing is handled entirely by Stripe. We store your Stripe customer ID and subscription status but never store card numbers or bank details.</p>
            <p><strong>Technical data:</strong> Error reports are collected via Sentry for debugging purposes and may include IP addresses, browser type, and request details. These are retained for 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide and maintain the Loyalshy platform</li>
              <li>To generate and deliver digital wallet passes (Apple Wallet, Google Wallet)</li>
              <li>To send transactional emails (pass delivery, account notifications) via Resend</li>
              <li>To process payments and manage subscriptions via Stripe</li>
              <li>To monitor and fix errors via Sentry</li>
              <li>To improve our product based on anonymized usage patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>4. Third-Party Services</h2>
            <p>We share data with the following services, each operating under their own privacy policies:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Stripe</strong> — Payment processing (PCI DSS compliant)</li>
              <li><strong>Resend</strong> — Transactional email delivery</li>
              <li><strong>Cloudflare R2</strong> — File storage (logos, images) via S3-compatible API</li>
              <li><strong>Sentry</strong> — Error tracking and monitoring</li>
              <li><strong>Plausible Analytics</strong> — Privacy-first website analytics (no cookies, no personal data)</li>
              <li><strong>Apple Wallet / Google Wallet</strong> — Digital pass generation and delivery</li>
              <li><strong>Neon</strong> — PostgreSQL database hosting</li>
              <li><strong>Vercel</strong> — Application hosting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>5. Data Retention</h2>
            <p>We retain your account data for as long as your account is active. Contact data is retained as long as the organization account exists. You may request deletion at any time.</p>
            <p>Error logs (Sentry) are retained for 30 days. Analytics data (Plausible) is aggregated and contains no personal information.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>6. Your Rights (GDPR)</h2>
            <p>If you are in the European Economic Area, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Access</strong> — Request a copy of the personal data we hold about you</li>
              <li><strong>Rectification</strong> — Ask us to correct inaccurate data</li>
              <li><strong>Erasure</strong> — Ask us to delete your personal data</li>
              <li><strong>Portability</strong> — Request your data in a machine-readable format</li>
              <li><strong>Restriction</strong> — Ask us to limit how we use your data</li>
              <li><strong>Objection</strong> — Object to our processing of your data</li>
            </ul>
            <p>To exercise any of these rights, email <a href="mailto:hello@loyalshy.com" className="underline">hello@loyalshy.com</a>. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>7. Data Security</h2>
            <p>We implement industry-standard security measures including HTTPS encryption, hashed passwords, secure session management, and role-based access controls. API keys are stored as SHA-256 hashes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>8. Children</h2>
            <p>Loyalshy is not intended for use by individuals under 16 years of age. We do not knowingly collect personal data from children.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>9. Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. We will notify registered users of material changes via email.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>10. Contact</h2>
            <p>For any questions about this privacy policy, contact us at <a href="mailto:hello@loyalshy.com" className="underline">hello@loyalshy.com</a>.</p>
          </section>
        </article>
      </div>
    </div>
  )
}
