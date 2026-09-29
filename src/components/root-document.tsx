import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "sonner"
import { NextIntlClientProvider } from "next-intl"
import { CookieBanner } from "@/components/cookie-banner"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { siteUrl } from "@/i18n/marketing"
import "@/app/globals.css"

// The <html> document shared by both root layouts:
//   src/app/(app)/layout.tsx      → app (cookie locale)
//   src/app/[locale]/layout.tsx   → marketing site (URL locale)

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Inter is the one body face on the web (landing, dashboard, studio, admin) —
// `--font-sans` in globals.css. Cabinet Grotesk is for display sizes only.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

export const rootViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
}

/** Metadata common to every page; titles/descriptions are set per layout. */
export const baseMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Loyalshy",
  },
  verification: {
    other: {
      "facebook-domain-verification": "61hyot3oi2z5ilk1ir2pa9w7epwk77",
    },
  },
}

// Only send shared namespaces at root level (~1KB instead of ~67KB).
// Route group layouts / pages provide their own namespaces via nested NextIntlClientProvider.
const SHARED_NAMESPACES = ["common", "errors", "cookieBanner"] as const

export function pickMessages(
  messages: Record<string, unknown>,
  namespaces: readonly string[]
): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const ns of namespaces) {
    if (ns in messages) picked[ns] = messages[ns]
  }
  return picked
}

export function RootDocument({
  locale,
  messages,
  children,
}: {
  locale: string
  messages: Record<string, unknown>
  children: React.ReactNode
}) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Cabinet Grotesk (Indian Type Foundry / Fontshare) — display
            sizes only, via globals.css. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800,900&display=swap"
        />
      </head>
      <body className={`${geistMono.variable} ${inter.variable} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={pickMessages(messages, SHARED_NAMESPACES)}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
            <SpeedInsights />
            <Analytics />
            <Toaster richColors position="top-center" />
            <CookieBanner />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
