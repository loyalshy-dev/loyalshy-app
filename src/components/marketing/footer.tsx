import Image from "next/image"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

interface FooterColumn {
  heading: string
  links: { label: string; href: string; external?: boolean }[]
}

export async function MarketingFooter() {
  const t = await getTranslations("footer")
  const tNav = await getTranslations("nav")
  const tCommon = await getTranslations("common")

  const FOOTER_COLUMNS: FooterColumn[] = [
    {
      heading: t("product"),
      links: [
        { label: tNav("features"), href: "#features" },
        { label: tNav("pricing"), href: "#pricing" },
        { label: tNav("faq"), href: "#faq" },
      ],
    },
    {
      heading: t("company"),
      links: [
        { label: tCommon("contact"), href: "/contact" },
      ],
    },
    {
      heading: t("legal"),
      links: [
        { label: t("privacyPolicy"), href: "/privacy" },
        { label: t("termsOfService"), href: "/terms" },
        { label: t("cookiePolicy"), href: "/cookies" },
      ],
    },
  ]

  return (
    <footer
      aria-label="Site footer"
      style={{
        background: "var(--mk-footer-bg)",
        color: "oklch(0.55 0.008 285)",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 pb-12 pt-16 sm:px-8 lg:px-10">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              aria-label="Loyalshy home"
            >
              <Image
                src="/logo.svg"
                alt="Loyalshy"
                width={120}
                height={32}
                className="h-10 w-auto invert"
              />
            </Link>
            <p
              className="mt-3 text-[14px] leading-relaxed max-w-[220px]"
              style={{ color: "oklch(0.45 0.008 285)" }}
            >
              {t("tagline")}
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2
                className="mb-4 text-xs font-semibold uppercase tracking-widest"
                style={{ color: "oklch(0.97 0 0)" }}
              >
                {column.heading}
              </h2>
              <ul className="space-y-3" role="list">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="text-[14px] transition-colors duration-150 hover:text-[oklch(0.55_0.17_155)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                      style={{ color: "oklch(0.55 0.008 285)" }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div
        className="mx-auto max-w-6xl px-6 py-6 sm:px-8 lg:px-10"
        style={{ borderTop: "1px solid oklch(0.22 0.008 285)" }}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p
            className="text-[13px]"
            style={{ color: "oklch(0.40 0.008 285)" }}
          >
            {t("copyright")}
          </p>
          <p
            className="text-[13px]"
            style={{ color: "oklch(0.40 0.008 285)" }}
          >
            {t("builtWith")}
          </p>
        </div>
        <p
          className="mt-3 text-[12px] leading-relaxed"
          style={{ color: "oklch(0.35 0.008 285)" }}
        >
          {tCommon("companyInfo.footerLine")}
        </p>
      </div>
    </footer>
  )
}
