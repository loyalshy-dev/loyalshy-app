import type { Metadata } from "next"
import Link from "next/link"

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com"

export const metadata: Metadata = {
  title: "Cookie Policy — Loyalshy",
  description: "How Loyalshy uses cookies and similar technologies.",
  alternates: { canonical: `${siteUrl}/cookies` },
  robots: { index: true, follow: true },
}

export default function CookiesPage() {
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
            Cookie Policy
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
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>1. What Are Cookies</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. They are widely used to
              make websites work efficiently and to provide information to site owners.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>2. Cookies We Use</h2>

            <h3 className="text-[15px] font-semibold mt-4 mb-2" style={{ color: "var(--mk-text, #111)" }}>Essential Cookies (Required)</h3>
            <p>These cookies are necessary for the platform to function and cannot be disabled.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Session cookie</strong> — Maintains your login session and authentication state.
                Set by Better Auth. Expires when your session ends or after the configured session lifetime.
              </li>
              <li>
                <strong>Active organization cookie</strong> — Remembers which organization you are currently
                working in. Required for multi-tenant functionality.
              </li>
              <li>
                <strong>Theme preference</strong> — Stores your light/dark mode preference. Set by next-themes.
                Persists until changed.
              </li>
            </ul>

            <h3 className="text-[15px] font-semibold mt-6 mb-2" style={{ color: "var(--mk-text, #111)" }}>Analytics (No Cookies)</h3>
            <p>
              We use <strong>Plausible Analytics</strong> for website analytics. Plausible is a privacy-first
              analytics service that does not use cookies, does not collect personal data, and does not track
              users across websites. No consent is required for Plausible under GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>3. Third-Party Cookies</h2>
            <p>
              <strong>Stripe:</strong> When you access the billing or checkout pages, Stripe may set cookies for
              fraud prevention and payment processing. These are governed by{" "}
              <a href="https://stripe.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">
                Stripe&apos;s Privacy Policy
              </a>.
            </p>
            <p>
              We do not use any advertising cookies, tracking pixels, or social media cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>4. Managing Cookies</h2>
            <p>
              You can control cookies through your browser settings. Most browsers allow you to block or delete
              cookies. However, blocking essential cookies will prevent you from using the Loyalshy dashboard.
            </p>
            <p>
              Since we only use essential cookies (no tracking or advertising cookies), no cookie consent
              banner is required under GDPR. Essential cookies are exempt from consent requirements as they
              are strictly necessary for the service to function.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>5. Changes</h2>
            <p>
              We may update this cookie policy if we introduce new cookie categories. We will update the
              &quot;Last updated&quot; date at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>6. Contact</h2>
            <p>For questions about our use of cookies, contact us at <a href="mailto:hello@loyalshy.com" className="underline">hello@loyalshy.com</a>.</p>
          </section>
        </article>
      </div>
    </div>
  )
}
