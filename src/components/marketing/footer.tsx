import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath } from "@/i18n/marketing"
import { Wordmark } from "@/components/brand-mark"
import { BRAND_PATHS, type BrandName } from "./brand-paths"

interface FooterColumn {
  heading: string
  links: { label: string; href: string; external?: boolean }[]
}

// The footer as it is on main: an ink ground, the wordmark with the
// tagline and the social marks, three link columns with white headings,
// and one legal line under a hairline. Links are 14px gray; hover lifts
// them to white. Four link columns since 2026-10-04: the secondary pages
// (industries, automations, team app, partners, status, subprocessors)
// are reached from here.

function BrandIcon({ name, className }: { name: BrandName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={BRAND_PATHS[name]} />
    </svg>
  )
}

const LINK = "text-[14px] transition-colors duration-150 hover:text-[oklch(0.97_0_0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
const MUTED = { color: "oklch(0.55 0.008 285)" }

export async function MarketingFooter() {
  const t = await getTranslations("footer")
  const tNav = await getTranslations("nav")
  const tCommon = await getTranslations("common")
  const locale = (await getLocale()) as Locale
  const home = localePath(locale, "/")

  const columns: FooterColumn[] = [
    {
      heading: t("product"),
      links: [
        { label: t("automations"), href: localePath(locale, "/automations") },
        { label: t("staffApp"), href: localePath(locale, "/staff-app") },
        { label: t("privatePrograms"), href: localePath(locale, "/private-programs") },
        { label: t("promote"), href: localePath(locale, "/promote") },
        { label: tNav("pricing"), href: localePath(locale, "/pricing") },
      ],
    },
    {
      heading: t("forBusiness"),
      links: [
        { label: t("cafes"), href: localePath(locale, "/for/cafes") },
        { label: t("salons"), href: localePath(locale, "/for/salons") },
        { label: t("retail"), href: localePath(locale, "/for/retail") },
        { label: t("allIndustries"), href: localePath(locale, "/for") },
      ],
    },
    {
      heading: t("company"),
      links: [
        { label: t("about"), href: localePath(locale, "/about") },
        { label: t("partners"), href: localePath(locale, "/partners") },
        { label: tCommon("contact"), href: localePath(locale, "/contact") },
        { label: t("status"), href: localePath(locale, "/status") },
      ],
    },
    {
      heading: t("legal"),
      links: [
        { label: t("privacyPolicy"), href: localePath(locale, "/privacy") },
        { label: t("termsOfService"), href: localePath(locale, "/terms") },
        { label: t("cookiePolicy"), href: localePath(locale, "/cookies") },
        { label: t("subprocessors"), href: localePath(locale, "/subprocessors") },
      ],
    },
  ]

  const social: { label: string; href: string; name: BrandName }[] = [
    { label: t("instagram"), href: "https://instagram.com/loyalshy", name: "instagram" },
    { label: t("tiktok"), href: "https://tiktok.com/@loyalshy_", name: "tiktok" },
  ]

  return (
    <footer aria-label="Site footer" style={{ background: "var(--mk-footer-bg)", ...MUTED }}>
      <div className="w-full px-6 pb-12 pt-16 sm:px-8 lg:px-12">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-5">
          {/* Brand column */}
          <div className="col-span-2 lg:col-span-1">
            <Link href={home} className="inline-flex items-center transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30" aria-label="Loyalshy">
              <Wordmark className="text-[22px] text-[oklch(0.97_0_0)]" />
            </Link>
            <p className="mt-3 max-w-[26ch] text-[14px] leading-relaxed" style={{ color: "oklch(0.62 0.008 285)" }}>
              {t("tagline")}
            </p>
            <ul className="mt-5 flex items-center gap-4" role="list">
              {social.map((s) => (
                <li key={s.name}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className={`inline-flex rounded-sm ${LINK}`} style={MUTED}>
                    <BrandIcon name={s.name} className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Link columns */}
          {columns.map((column) => (
            <div key={column.heading}>
              <h2 className="mb-4 text-xs font-semibold tracking-wide" style={{ color: "oklch(0.97 0 0)" }}>
                {column.heading}
              </h2>
              <ul className="space-y-3" role="list">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={LINK} style={MUTED}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full px-6 py-6 sm:px-8 lg:px-12" style={{ borderTop: "1px solid oklch(0.3 0.008 285)" }}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px]" style={{ color: "oklch(0.5 0.008 285)" }}>{t("copyright")}</p>
          <p className="text-[13px]" style={{ color: "oklch(0.5 0.008 285)" }}>{t("builtWith")}</p>
        </div>
      </div>
    </footer>
  )
}
