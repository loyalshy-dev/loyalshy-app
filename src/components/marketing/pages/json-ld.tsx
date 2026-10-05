import { getTranslations } from "next-intl/server"
import { locales, type Locale } from "@/i18n/config"
import { marketingUrl, siteUrl, type MarketingPath } from "@/i18n/marketing"

// ─── JSON-LD for the marketing pages ─────────────────────────
// One graph per page: the shared Organization + WebSite nodes (so every
// page carries the entity, not only the home), a WebPage node and its
// BreadcrumbList, plus whatever the page adds (offers on /pricing, the
// mobile app on /staff-app). No FAQPage or HowTo: neither earns a rich
// result for a SaaS site any more.

export type Node = Record<string, unknown>
type PageType = "WebPage" | "ContactPage" | "AboutPage" | "CollectionPage"
export type Crumb = { name: string; path: MarketingPath }

// Languages the team answers support and sales mail in. Deliberately not the
// site's `locales`: a page can render in German before anyone here replies in it.
const SUPPORT_LANGUAGES = ["es", "en", "fr"] as const

export const ORG_ID = `${siteUrl}/#organization`
export const SITE_ID = `${siteUrl}/#website`
export const SOFTWARE_ID = `${siteUrl}/#software`
export const STAFF_APP_ID = `${siteUrl}/#staff-app`

/** The Organization + WebSite, identical on every page (description localized). */
export async function siteNodes(locale: Locale): Promise<Node[]> {
  const t = await getTranslations({ locale, namespace: "metadata.home" })
  const contact = marketingUrl(locale, "/contact")
  return [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "Loyalshy",
      legalName: "HEX CONCEPTS STUDIO, S.L.",
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
      email: "hello@loyalshy.com",
      taxID: "B27646645",
      vatID: "ESB27646645",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Av. Convent 11",
        postalCode: "25123",
        addressLocality: "Torrefarrera",
        addressRegion: "Lleida",
        addressCountry: "ES",
      },
      contactPoint: [
        { "@type": "ContactPoint", contactType: "customer support", email: "hello@loyalshy.com", url: `${contact}?type=support`, availableLanguage: [...SUPPORT_LANGUAGES] },
        { "@type": "ContactPoint", contactType: "sales", email: "hello@loyalshy.com", url: `${contact}?type=sales`, availableLanguage: [...SUPPORT_LANGUAGES] },
      ],
      sameAs: ["https://www.instagram.com/loyalshy/", "https://www.tiktok.com/@loyalshy_"],
      description: t("jsonLdDescription"),
    },
    { "@type": "WebSite", "@id": SITE_ID, name: "Loyalshy", url: siteUrl, publisher: { "@id": ORG_ID }, inLanguage: [...locales] },
  ]
}

/** WebPage + BreadcrumbList for a marketing page; `extra` holds page-specific nodes. */
export async function pageJsonLd(
  locale: Locale,
  path: MarketingPath,
  key: string,
  opts: { type?: PageType; parents?: Crumb[]; about?: string; mainEntity?: string; extra?: Node[] } = {},
) {
  const t = await getTranslations({ locale, namespace: `metadata.${key}` })
  const url = marketingUrl(locale, path)
  const crumbs: Crumb[] = [{ name: "Loyalshy", path: "/" }, ...(opts.parents ?? []), { name: t("title"), path }]
  const breadcrumb: Node = {
    "@type": "BreadcrumbList",
    "@id": `${url}/#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: marketingUrl(locale, c.path) })),
  }
  const page: Node = {
    "@type": opts.type ?? "WebPage",
    "@id": `${url}/#webpage`,
    url,
    name: t("title"),
    description: t("description"),
    isPartOf: { "@id": SITE_ID },
    about: { "@id": opts.about ?? SOFTWARE_ID },
    breadcrumb: { "@id": breadcrumb["@id"] },
    inLanguage: locale,
    ...(opts.mainEntity ? { mainEntity: { "@id": opts.mainEntity } } : {}),
  }
  return { "@context": "https://schema.org", "@graph": [...(await siteNodes(locale)), page, breadcrumb, ...(opts.extra ?? [])] }
}

export function JsonLd({ data }: { data: unknown }) {
  // "<" escaped so a translated string can never close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
}
