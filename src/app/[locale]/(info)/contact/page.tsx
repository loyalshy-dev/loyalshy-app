import type { Metadata } from "next"
import { Suspense } from "react"
import { getTranslations, getMessages, setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { marketingAlternates, marketingSocial } from "@/i18n/marketing"
import { NextIntlClientProvider } from "next-intl"
import { MarketingNavbar } from "@/components/marketing/navbar"
import { MarketingFooter } from "@/components/marketing/footer"
import { ContactForm } from "@/components/marketing/contact-form"
import { JsonLd, ORG_ID, pageJsonLd } from "@/components/marketing/pages/json-ld"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  const t = await getTranslations({ locale, namespace: "metadata.contact" })
  return {
    title: t("title"),
    description: t("description"),
    alternates: marketingAlternates(locale, "/contact"),
    ...marketingSocial(locale, "/contact", `${t("title")} — Loyalshy`, t("description")),
  }
}

const CONTACT_NAMESPACES = ["common", "nav", "footer", "contact"] as const

const HIGHLIGHT_KEYS = ["general", "sales", "partnership", "support"] as const

export default async function ContactPage({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  const t = await getTranslations("contact")
  const tCommon = await getTranslations("common")
  const jsonLd = await pageJsonLd(locale, "/contact", "contact", { type: "ContactPage", mainEntity: ORG_ID })
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
          <JsonLd data={jsonLd} />
          <section style={{ background: "var(--mk-bg)" }}>
            <div className="mk-wrap py-14 lg:py-20">
              <div className="max-w-[52ch]">
                <h1 className="font-display mk-display-2" style={{ color: "var(--mk-text)" }}>
                  {t("pageTitle")}
                </h1>
                <p className="mk-lead mt-4">{t("pageSubtitle")}</p>
              </div>

              <div className="mt-12 grid gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-8">
                <div className="lg:col-span-7">
                  <div className="rounded-2xl p-6 sm:p-8" style={{ border: "1px solid var(--mk-border)" }}>
                    <Suspense>
                      <ContactForm />
                    </Suspense>
                  </div>
                </div>

                <aside className="lg:col-span-4 lg:col-start-9">
                  <ul className="border-t" style={{ borderColor: "var(--mk-border)" }}>
                    {HIGHLIGHT_KEYS.map((key) => (
                      <li key={key} className="border-b py-5" style={{ borderColor: "var(--mk-border)" }}>
                        <h2 className="text-[15px] font-semibold tracking-[-0.012em]" style={{ color: "var(--mk-text)" }}>
                          {t(`highlights.${key}.title`)}
                        </h2>
                        <p className="mk-body-sm mt-1" style={{ color: "var(--mk-text-muted)" }}>
                          {t(`highlights.${key}.description`)}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="mk-body-sm mt-6" style={{ color: "var(--mk-text-muted)" }}>
                    {t("directEmail")}{" "}
                    <a href="mailto:hello@loyalshy.com" className="font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
                      hello@loyalshy.com
                    </a>
                  </p>
                  <address className="mk-body-sm mt-6 not-italic" style={{ color: "var(--mk-text-muted)" }}>
                    <span className="font-medium" style={{ color: "var(--mk-text)" }}>{tCommon("companyInfo.name")}</span>
                    <br />
                    {tCommon("companyInfo.address")}
                  </address>
                </aside>
              </div>
            </div>
          </section>
        </main>

        <MarketingFooter />
      </div>
    </NextIntlClientProvider>
  )
}
