import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Mail, MessageSquare, Handshake, HelpCircle } from "lucide-react"
import { getTranslations, getMessages } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { ContactForm } from "@/components/marketing/contact-form"

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com"

export const metadata: Metadata = {
  title: "Contact Us — Loyalshy",
  description:
    "Get in touch with the Loyalshy team. Questions about our digital wallet pass platform, enterprise plans, or partnerships — we'd love to hear from you.",
  alternates: { canonical: `${siteUrl}/contact` },
  robots: { index: true, follow: true },
}

const CONTACT_NAMESPACES = ["common", "contact"] as const

export default async function ContactPage() {
  const t = await getTranslations("contact")
  const tCommon = await getTranslations("common")
  const messages = await getMessages()
  const contactMessages: Record<string, unknown> = {}
  for (const ns of CONTACT_NAMESPACES) {
    if (ns in messages) contactMessages[ns] = messages[ns as keyof typeof messages]
  }

  const highlights = [
    {
      icon: MessageSquare,
      title: t("highlights.general.title"),
      description: t("highlights.general.description"),
    },
    {
      icon: Mail,
      title: t("highlights.sales.title"),
      description: t("highlights.sales.description"),
    },
    {
      icon: Handshake,
      title: t("highlights.partnership.title"),
      description: t("highlights.partnership.description"),
    },
    {
      icon: HelpCircle,
      title: t("highlights.support.title"),
      description: t("highlights.support.description"),
    },
  ]

  return (
    <div className="min-h-screen" style={{ background: "var(--mk-bg, #fafafa)" }}>
      {/* Gradient mesh background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.55 0.2 265 / 0.06) 0%, transparent 70%),
            radial-gradient(ellipse 50% 60% at 80% 80%, oklch(0.55 0.17 155 / 0.04) 0%, transparent 70%)
          `,
        }}
      />

      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        {/* Back link */}
        <Link
          href="/"
          className="text-[14px] font-medium mb-8 inline-block transition-opacity hover:opacity-70"
          style={{ color: "var(--mk-text-muted, #666)" }}
        >
          {tCommon("backToHome")}
        </Link>

        {/* Header */}
        <header className="mb-16 max-w-2xl">
          <h1
            className="text-[clamp(2rem,4vw,3rem)] font-bold leading-tight"
            style={{ color: "var(--mk-text, #111)", letterSpacing: "-0.03em" }}
          >
            {t("pageTitle")}
          </h1>
          <p
            className="mt-4 text-[17px] leading-relaxed max-w-lg"
            style={{ color: "var(--mk-text-muted, #666)" }}
          >
            {t("pageSubtitle")}
          </p>
        </header>

        <div className="grid gap-16 lg:grid-cols-5">
          {/* Left — Form */}
          <div className="relative lg:col-span-3">
            <div
              className="rounded-2xl border p-8 sm:p-10"
              style={{
                background: "var(--mk-card, #fff)",
                borderColor: "var(--mk-border, #e5e7eb)",
              }}
            >
              <NextIntlClientProvider messages={contactMessages}>
                <Suspense>
                  <ContactForm />
                </Suspense>
              </NextIntlClientProvider>
            </div>
          </div>

          {/* Right — Info cards */}
          <div className="space-y-5 lg:col-span-2">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border p-6"
                style={{
                  background: "var(--mk-card, #fff)",
                  borderColor: "var(--mk-border, #e5e7eb)",
                }}
              >
                <div
                  className="mb-3 flex size-10 items-center justify-center rounded-lg"
                  style={{ background: "oklch(0.55 0.2 265 / 0.08)" }}
                >
                  <item.icon
                    className="size-5"
                    style={{ color: "oklch(0.55 0.2 265)" }}
                  />
                </div>
                <h3
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--mk-text, #111)" }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-1 text-[13px] leading-relaxed"
                  style={{ color: "var(--mk-text-muted, #666)" }}
                >
                  {item.description}
                </p>
              </div>
            ))}

            {/* Direct email fallback */}
            <div
              className="rounded-xl border p-6"
              style={{
                borderColor: "var(--mk-border, #e5e7eb)",
                background: "transparent",
              }}
            >
              <p
                className="text-[13px]"
                style={{ color: "var(--mk-text-dimmed, #999)" }}
              >
                {t("directEmail")}{" "}
                <a
                  href="mailto:hello@loyalshy.com"
                  className="underline transition-opacity hover:opacity-70"
                  style={{ color: "var(--mk-text-muted, #666)" }}
                >
                  hello@loyalshy.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
