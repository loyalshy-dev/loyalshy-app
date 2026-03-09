import Image from "next/image"
import Link from "next/link"

interface FooterColumn {
  heading: string
  links: { label: string; href: string; external?: boolean }[]
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "mailto:hello@loyalshy.com" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer
      aria-label="Site footer"
      style={{
        background: "oklch(0.13 0.005 285)",
        color: "oklch(0.55 0.008 285)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2"
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
              className="mt-3 text-sm leading-relaxed"
              style={{ color: "oklch(0.45 0.008 285)" }}
            >
              Digital loyalty cards for modern businesses.
            </p>
          </div>

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
                      className="text-sm transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-1"
                      style={{ color: "oklch(0.50 0.008 285)" }}
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
        className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
        style={{ borderTop: "1px solid oklch(0.22 0.008 285)" }}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm" style={{ color: "oklch(0.40 0.008 285)" }}>
            &copy; 2026 Loyalshy. All rights reserved.
          </p>
          <p className="text-sm" style={{ color: "oklch(0.40 0.008 285)" }}>
            Built with care for business owners.
          </p>
        </div>
      </div>
    </footer>
  )
}
