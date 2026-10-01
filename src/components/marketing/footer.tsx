import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import type { Locale } from "@/i18n/config"
import { localePath } from "@/i18n/marketing"
import { BrandMark } from "@/components/brand-mark"

interface FooterColumn {
  heading: string
  links: { label: string; href: string; external?: boolean }[]
}

/* ─── Footer ──────────────────────────────────────────────────────── */

// In the Apple manner: quiet gray ground, 12px type, a note block with the
// company's legal identity, three link columns (accordions on phones), and
// one legal line. The mark sits where Apple puts its own.

const DEMO_JOIN_URL = process.env.NEXT_PUBLIC_DEMO_JOIN_URL

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
        { label: tNav("cards"), href: `${home}#cards` },
        { label: tNav("dashboard"), href: `${home}#features` },
        { label: tNav("pricing"), href: `${home}#pricing` },
        ...(DEMO_JOIN_URL ? [{ label: t("tryDemo"), href: `${home}#try-demo` }] : []),
      ],
    },
    {
      heading: t("company"),
      links: [
        { label: tCommon("contact"), href: localePath(locale, "/contact") },
        { label: tNav("faq"), href: `${home}#faq` },
      ],
    },
    {
      heading: t("follow"),
      links: [
        { label: "Instagram", href: "https://instagram.com/loyalshy", external: true },
        { label: "TikTok", href: "https://tiktok.com/@loyalshy_", external: true },
      ],
    },
    {
      heading: t("legal"),
      links: [
        { label: t("privacyPolicy"), href: localePath(locale, "/privacy") },
        { label: t("termsOfService"), href: localePath(locale, "/terms") },
        { label: t("cookiePolicy"), href: localePath(locale, "/cookies") },
      ],
    },
  ]

  const linkList = (links: FooterColumn["links"]) => (
    <ul role="list">
      {links.map((link) => (
        <li key={link.label}>
          <a href={link.href} {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  )

  return (
    <footer className="mk-footer" aria-label="Site footer">
      <div className="mk-footer-inner">
        <div className="mk-footer-note">
          <p>{t("tagline")}</p>
        </div>

        <div className="mk-footer-cols">
          {columns.map((column) => (
            <div key={column.heading} className="mk-footer-col">
              <h2>{column.heading}</h2>
              {linkList(column.links)}
              <details>
                <summary>{column.heading}</summary>
                {linkList(column.links)}
              </details>
            </div>
          ))}
        </div>

        <div className="mk-footer-legal">
          <p className="flex items-start gap-2">
            <Link href={home} aria-label="Loyalshy" className="inline-flex shrink-0 pt-[1px]" style={{ color: "var(--mk-accent)" }}>
              <BrandMark className="h-2.5" />
            </Link>
            <span>{t("copyright")}</span>
          </p>
          <p>{t("builtWith")}</p>
        </div>
      </div>
    </footer>
  )
}
