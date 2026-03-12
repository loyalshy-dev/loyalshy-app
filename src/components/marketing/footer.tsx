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
      { label: "API Docs", href: "/api/v1/docs" },
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

/* ─── Social icons (placeholders) ─────────────────────────────────── */

function TwitterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

export function MarketingFooter() {
  return (
    <footer
      aria-label="Site footer"
      style={{
        background: "oklch(0.13 0.005 285)",
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
              Digital loyalty cards for modern businesses.
            </p>

            {/* Social links */}
            <div className="mt-5 flex items-center gap-3">
              <a
                href="#"
                className="flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
                style={{ color: "oklch(0.50 0.008 285)" }}
                aria-label="Twitter"
              >
                <TwitterIcon />
              </a>
              <a
                href="#"
                className="flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
                style={{ color: "oklch(0.50 0.008 285)" }}
                aria-label="LinkedIn"
              >
                <LinkedInIcon />
              </a>
            </div>
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
                      className="text-[14px] transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
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
        className="mx-auto max-w-6xl px-6 py-6 sm:px-8 lg:px-10"
        style={{ borderTop: "1px solid oklch(0.22 0.008 285)" }}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p
            className="text-[13px]"
            style={{ color: "oklch(0.40 0.008 285)" }}
          >
            &copy; 2026 Loyalshy. All rights reserved.
          </p>
          <p
            className="text-[13px]"
            style={{ color: "oklch(0.40 0.008 285)" }}
          >
            Built with care for business owners.
          </p>
        </div>
      </div>
    </footer>
  )
}
