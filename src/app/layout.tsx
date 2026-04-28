import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { CookieBanner } from "@/components/cookie-banner";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Inter loads globally but only applies on surfaces marked `data-brand="loyalshy"`.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Loyalshy — Digital Loyalty Cards for Small Businesses",
    template: "%s — Loyalshy",
  },
  description:
    "Replace paper stamp cards with digital ones in Apple and Google Wallet. Reward repeat customers with stamp cards and coupons — no app required.",
  keywords: [
    "digital loyalty cards",
    "Apple Wallet",
    "Google Wallet",
    "stamp cards",
    "digital coupons",
    "loyalty program",
    "small business loyalty",
    "café loyalty",
    "salon loyalty",
  ],
  openGraph: {
    type: "website",
    siteName: "Loyalshy",
    title: "Loyalshy — Digital Loyalty Cards for Small Businesses",
    description:
      "Replace paper stamp cards with digital ones in Apple and Google Wallet. Reward repeat customers — no app required.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Loyalshy — Digital Loyalty Cards for Small Businesses",
    description:
      "Replace paper stamp cards with digital ones in Apple and Google Wallet. Reward repeat customers — no app required.",
  },
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
};

// Only send shared namespaces at root level (~1KB instead of ~67KB).
// Route group layouts provide their own namespaces via nested NextIntlClientProvider.
const SHARED_NAMESPACES = ["common", "errors", "cookieBanner"] as const;

function pickMessages(
  messages: Record<string, unknown>,
  namespaces: readonly string[]
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const ns of namespaces) {
    if (ns in messages) picked[ns] = messages[ns];
  }
  return picked;
}

async function IntlProvider({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Cabinet Grotesk (Indian Type Foundry / Fontshare) — applied only on
            surfaces marked data-brand="loyalshy" via globals.css. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800&display=swap"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased`}
      >
        <NextIntlClientProvider messages={pickMessages(messages, SHARED_NAMESPACES)}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
            <SpeedInsights />
            <Analytics />
            <Toaster richColors position="top-center" />
            <CookieBanner />
          </ThemeProvider>
        </NextIntlClientProvider>
        <AnalyticsProvider />
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense>
      <IntlProvider>{children}</IntlProvider>
    </Suspense>
  );
}
