import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { pageMetadata } from "@/components/marketing/pages/metadata"
import { IndustryPage } from "@/components/marketing/pages/industry-page"

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Validated by the [locale] layout.
  const locale = (await params).locale as Locale
  return pageMetadata(locale, "/for/retail", "retail")
}

export default async function Page({ params }: PageProps) {
  const locale = (await params).locale as Locale
  setRequestLocale(locale)
  return <IndustryPage locale={locale} slug="retail" />
}
