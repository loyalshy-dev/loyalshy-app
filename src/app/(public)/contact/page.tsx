import type { Metadata } from "next"
import { Suspense } from "react"
import { Mail, MessageSquare, Handshake, HelpCircle, ArrowRight } from "lucide-react"
import { getTranslations, getMessages } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { MarketingNavbar } from "@/components/marketing/navbar"
import { MarketingFooter } from "@/components/marketing/footer"
import { FadeIn, Stagger, StaggerItem } from "@/components/marketing/motion"
import { ContactForm } from "@/components/marketing/contact-form"

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com"

export const metadata: Metadata = {
  title: "Contact Us — Loyalshy",
  description:
    "Get in touch with the Loyalshy team. Questions about our digital wallet pass platform, enterprise plans, or partnerships — we'd love to hear from you.",
  alternates: { canonical: `${siteUrl}/contact` },
  robots: { index: true, follow: true },
}

const CONTACT_NAMESPACES = ["common", "nav", "footer", "contact"] as const

const HIGHLIGHT_ICONS = [MessageSquare, Mail, Handshake, HelpCircle] as const
const HIGHLIGHT_KEYS = ["general", "sales", "partnership", "support"] as const

export default async function ContactPage() {
  const t = await getTranslations("contact")
  const messages = await getMessages()
  const contactMessages: Record<string, unknown> = {}
  for (const ns of CONTACT_NAMESPACES) {
    if (ns in messages) contactMessages[ns] = messages[ns as keyof typeof messages]
  }

  return (
    <NextIntlClientProvider messages={contactMessages}>
      <div className="min-h-screen" style={{ background: "var(--mk-bg)" }}>
        <MarketingNavbar />

        <main>
          {/* ─── Hero section ─────────────────────────────────────── */}
          <section
            className="relative overflow-hidden pt-12 sm:pt-24 pb-20 sm:pb-32"
            style={{ background: "var(--mk-bg)" }}
          >
            {/* Gradient mesh */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background: `
                  radial-gradient(ellipse 60% 50% at 70% 30%, oklch(0.55 0.2 265 / 0.07) 0%, transparent 70%),
                  radial-gradient(ellipse 40% 60% at 20% 70%, oklch(0.55 0.17 155 / 0.05) 0%, transparent 70%),
                  radial-gradient(ellipse 80% 40% at 50% 90%, oklch(0.55 0.2 265 / 0.03) 0%, transparent 70%)
                `,
              }}
            />

            {/* Geometric canvas shapes */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              {/* Top-left angular block */}
              <div
                className="absolute -left-20 -top-12 h-72 w-64 rotate-12 rounded-3xl"
                style={{ background: "oklch(0.82 0.12 290)" }}
              />
              {/* Top-right — electric indigo */}
              <div
                className="absolute -right-10 top-16 h-56 w-52 rotate-45 rounded-2xl"
                style={{ background: "oklch(0.75 0.15 265)" }}
              />
              {/* Bottom-left — mint */}
              <div
                className="absolute -left-16 bottom-16 h-64 w-56 -rotate-12 rounded-3xl"
                style={{ background: "oklch(0.85 0.12 165)" }}
              />
              {/* Bottom-right — soft violet */}
              <div
                className="absolute -right-24 -bottom-10 h-80 w-72 rotate-[25deg] rounded-3xl"
                style={{ background: "oklch(0.78 0.14 300)" }}
              />
              {/* Floating diamond — coral pink */}
              <div
                className="absolute left-[6%] top-[42%] size-12 rotate-45 rounded-lg"
                style={{ background: "oklch(0.80 0.12 15)" }}
              />
              {/* Floating diamond — sky blue */}
              <div
                className="absolute right-[10%] top-[28%] size-9 rotate-45 rounded-lg"
                style={{ background: "oklch(0.82 0.10 230)" }}
              />
              {/* Small accent — lime */}
              <div
                className="absolute left-[58%] bottom-[12%] size-7 rotate-12 rounded-md"
                style={{ background: "oklch(0.88 0.14 140)" }}
              />
            </div>

            <div className="mx-auto max-w-6xl px-6 lg:px-8">
              {/* Header — centered, hero-style */}
              <FadeIn>
                <div className="mx-auto max-w-2xl text-center mb-16 sm:mb-20">
                  <p
                    className="mb-4 inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-bold tracking-[0.08em] uppercase"
                    style={{
                      border: "1px solid var(--mk-border)",
                      background: "var(--mk-card)",
                      color: "var(--mk-text-dimmed)",
                    }}
                  >
                    {t("sectionLabel")}
                  </p>
                  <h1
                    className="text-[clamp(2.2rem,5vw,3.5rem)] font-extrabold leading-[1.08]"
                    style={{ color: "var(--mk-text)", letterSpacing: "-0.04em" }}
                  >
                    {t("pageTitle")}
                  </h1>
                  <p
                    className="mt-5 text-[17px] leading-relaxed mx-auto max-w-lg"
                    style={{ color: "var(--mk-text-muted)" }}
                  >
                    {t("pageSubtitle")}
                  </p>
                </div>
              </FadeIn>

              {/* ─── Main grid ──────────────────────────────────── */}
              <div className="grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-16">
                {/* Left — Form card */}
                <FadeIn delay={0.1}>
                  <div className="mk-card-glass p-8 sm:p-10">
                    <Suspense>
                      <ContactForm />
                    </Suspense>
                  </div>
                </FadeIn>

                {/* Right — Info cards */}
                <FadeIn delay={0.2}>
                  <div className="flex flex-col">
                    <Stagger stagger={0.06} className="flex flex-col gap-4">
                      {HIGHLIGHT_KEYS.map((key, i) => {
                        const Icon = HIGHLIGHT_ICONS[i]
                        return (
                          <StaggerItem key={key}>
                            <div className="group relative flex gap-4 p-5 rounded-2xl transition-all duration-250 hover:-translate-y-0.5"
                              style={{
                                background: "var(--mk-card)",
                                border: "1px solid var(--mk-border)",
                                boxShadow: "0 1px 3px oklch(0 0 0 / 0.04)",
                              }}
                            >
                              {/* Top accent on hover */}
                              <div
                                aria-hidden="true"
                                className="absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                                style={{
                                  background: "linear-gradient(90deg, transparent, oklch(0.55 0.2 265 / 0.4), transparent)",
                                }}
                              />
                              <div
                                className="flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 group-hover:bg-[oklch(0.55_0.2_265/0.08)]"
                                style={{
                                  background: "var(--mk-surface)",
                                  border: "1px solid var(--mk-border)",
                                }}
                              >
                                <Icon
                                  className="size-[18px] transition-colors duration-200 group-hover:text-[oklch(0.55_0.2_265)]"
                                  strokeWidth={1.5}
                                  style={{ color: "var(--mk-text-muted)" }}
                                />
                              </div>
                              <div className="min-w-0">
                                <h3
                                  className="text-[14px] font-semibold"
                                  style={{ color: "var(--mk-text)", letterSpacing: "-0.01em" }}
                                >
                                  {t(`highlights.${key}.title`)}
                                </h3>
                                <p
                                  className="mt-1 text-[13px] leading-relaxed"
                                  style={{ color: "var(--mk-text-muted)" }}
                                >
                                  {t(`highlights.${key}.description`)}
                                </p>
                              </div>
                            </div>
                          </StaggerItem>
                        )
                      })}
                    </Stagger>

                    {/* Direct email */}
                    <div
                      className="mt-2 rounded-2xl p-5"
                      style={{
                        background: "oklch(0.55 0.2 265 / 0.04)",
                        border: "1px solid oklch(0.55 0.2 265 / 0.08)",
                      }}
                    >
                      <p
                        className="text-[13px] leading-relaxed"
                        style={{ color: "var(--mk-text-muted)" }}
                      >
                        {t("directEmail")}{" "}
                        <a
                          href="mailto:hello@loyalshy.com"
                          className="inline-flex items-center gap-1 font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
                          style={{ color: "var(--mk-text)" }}
                        >
                          hello@loyalshy.com
                          <ArrowRight className="size-3" />
                        </a>
                      </p>
                    </div>
                  </div>
                </FadeIn>
              </div>
            </div>
          </section>
        </main>

        <MarketingFooter />
      </div>
    </NextIntlClientProvider>
  )
}
