import type { Metadata } from "next"
import Link from "next/link"

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com"

export const metadata: Metadata = {
  title: "Terms of Service — Loyalshy",
  description: "Terms and conditions for using the Loyalshy platform.",
  alternates: { canonical: `${siteUrl}/terms` },
  robots: { index: true, follow: true },
}

export default function TermsPage() {
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
            Terms of Service
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
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>1. Agreement</h2>
            <p>
              By accessing or using Loyalshy (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
              If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>2. Description of Service</h2>
            <p>
              Loyalshy is a digital wallet pass platform that enables businesses to create, manage, and distribute
              Apple Wallet and Google Wallet passes. The platform supports stamp cards, coupons, memberships,
              points programs, prepaid passes, gift cards, tickets, access passes, transit passes, and business IDs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>3. Accounts</h2>
            <p>
              You must provide accurate information when creating an account. You are responsible for maintaining the
              security of your account credentials. You must notify us immediately of any unauthorized access.
            </p>
            <p>
              Each organization on Loyalshy operates as a separate tenant. Organization owners are responsible for
              managing team members and their access levels.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Upload malicious content or attempt to compromise system security</li>
              <li>Exceed your plan&apos;s usage limits through automated means</li>
              <li>Resell or redistribute the Service without authorization</li>
              <li>Collect personal data through the platform without the consent of the data subjects</li>
              <li>Create passes that impersonate other businesses or mislead consumers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>5. Pricing and Billing</h2>
            <p>
              Loyalshy offers Free, Pro, Business, Scale, and Enterprise plans. Paid plans are billed monthly or
              annually via Stripe. Prices are in EUR. You may cancel your subscription at any time, which will
              downgrade your account to the Free plan at the end of the current billing period.
            </p>
            <p>
              We reserve the right to change pricing with 30 days&apos; notice to existing customers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>6. Data Ownership</h2>
            <p>
              You retain ownership of all content and data you upload to Loyalshy. We do not claim any intellectual
              property rights over your business data, logos, images, or contact lists.
            </p>
            <p>
              You grant us a limited license to process your data solely for the purpose of providing the Service,
              including generating wallet passes and sending transactional communications on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>7. API Usage</h2>
            <p>
              Access to the Loyalshy REST API is subject to rate limits based on your plan. API keys are
              organization-scoped and must be kept confidential. We reserve the right to revoke API access for
              abusive usage patterns.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>8. Availability</h2>
            <p>
              We aim to maintain high availability but do not guarantee uninterrupted service. We are not liable for
              any downtime, data loss, or service interruptions. We will make reasonable efforts to notify users of
              scheduled maintenance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>9. Termination</h2>
            <p>
              We may suspend or terminate accounts that violate these terms. You may delete your account at any time.
              Upon termination, your data will be deleted within 30 days unless retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Loyalshy shall not be liable for any indirect, incidental,
              special, or consequential damages arising from your use of the Service. Our total liability shall not
              exceed the amount you have paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>11. Governing Law</h2>
            <p>
              These terms shall be governed by the laws of the European Union. Any disputes shall be resolved in the
              courts of the jurisdiction where Loyalshy is registered.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>12. Changes</h2>
            <p>
              We may update these terms from time to time. Material changes will be communicated via email to
              registered users at least 30 days before taking effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--mk-text, #111)" }}>13. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:hello@loyalshy.com" className="underline">hello@loyalshy.com</a>.</p>
          </section>
        </article>
      </div>
    </div>
  )
}
