import type { Metadata, Viewport } from "next"
import { notFound } from "next/navigation"
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server"
import { RootDocument, baseMetadata, rootViewport } from "@/components/root-document"
import { LocaleCookieSync } from "@/components/marketing/locale-cookie-sync"
import { locales } from "@/i18n/config"
import { isLocale, marketingAlternates, marketingSocial } from "@/i18n/marketing"

// Root layout for the marketing site. The locale comes from the URL
// (/, /es, /fr — see src/i18n/marketing.ts), so every language is its
// own crawlable page with hreflang alternates.

export const viewport: Viewport = rootViewport

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Omit<LayoutProps, "children">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getTranslations({ locale, namespace: "metadata.home" })

  return {
    ...baseMetadata,
    title: {
      default: t("title"),
      template: "%s — Loyalshy",
    },
    description: t("description"),
    alternates: marketingAlternates(locale, "/"),
    ...marketingSocial(locale, "/", t("title"), t("description")),
  }
}

export default async function MarketingRootLayout({ children, params }: LayoutProps) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <RootDocument locale={locale} messages={messages}>
      <LocaleCookieSync locale={locale} />
      {children}
    </RootDocument>
  )
}
