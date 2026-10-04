import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { MarketingNavbar } from "@/components/marketing/navbar"
import { MarketingFooter } from "@/components/marketing/footer"

// The frame every secondary marketing page shares: the global bar, the
// page, the footer, on the same paper as the landing. Only the namespaces a
// client component needs travel to the browser (the bar needs `common` +
// `nav`; the pricing table needs `pricing`); everything else is rendered on
// the server from `pages.*` and passed down as props.

const BASE_NAMESPACES = ["common", "nav"] as const

export async function MarketingPage({
  children,
  clientNamespaces = [],
}: {
  children: React.ReactNode
  clientNamespaces?: readonly string[]
}) {
  const messages = await getMessages()
  const picked: Record<string, unknown> = {}
  for (const ns of [...BASE_NAMESPACES, ...clientNamespaces]) {
    if (ns in messages) picked[ns] = messages[ns as keyof typeof messages]
  }

  return (
    <NextIntlClientProvider messages={picked}>
      <div data-brand="loyalshy" className="min-h-screen" style={{ background: "var(--mk-bg)" }}>
        <MarketingNavbar />
        <main>{children}</main>
        <MarketingFooter />
      </div>
    </NextIntlClientProvider>
  )
}
