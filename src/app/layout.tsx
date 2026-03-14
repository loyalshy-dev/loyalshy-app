import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AnalyticsProvider } from "@/components/analytics-provider";
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
    default: "Loyalshy — Digital Wallet Passes for Any Business",
    template: "%s — Loyalshy",
  },
  description:
    "Create digital wallet passes for Apple and Google Wallet. Stamp cards, memberships, coupons, tickets, prepaid passes, and more — all from one platform.",
  keywords: [
    "digital wallet passes",
    "Apple Wallet",
    "Google Wallet",
    "loyalty cards",
    "membership cards",
    "digital coupons",
    "stamp cards",
    "event tickets",
    "prepaid passes",
    "gift cards",
  ],
  openGraph: {
    type: "website",
    siteName: "Loyalshy",
    title: "Loyalshy — Digital Wallet Passes for Any Business",
    description:
      "Create digital wallet passes for Apple and Google Wallet. Stamp cards, memberships, coupons, tickets, prepaid passes, and more.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Loyalshy — Digital Wallet Passes for Any Business",
    description:
      "Create digital wallet passes for Apple and Google Wallet. Stamp cards, memberships, coupons, tickets, prepaid passes, and more.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <SpeedInsights />
          <Analytics />
          <Toaster richColors position="top-center" />
        </ThemeProvider>
        <AnalyticsProvider />
      </body>
    </html>
  );
}
