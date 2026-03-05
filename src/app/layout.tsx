import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AnalyticsProvider } from "@/components/analytics-provider";
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
    default: "Loyalshy — Digital Loyalty Cards for Restaurants",
    template: "%s — Loyalshy",
  },
  description:
    "Create digital loyalty cards with Apple and Google Wallet passes for your restaurant. Boost repeat visits and reward your best customers.",
  keywords: [
    "loyalty cards",
    "digital loyalty",
    "restaurant loyalty program",
    "Apple Wallet",
    "Google Wallet",
    "customer rewards",
    "stamp card",
  ],
  openGraph: {
    type: "website",
    siteName: "Loyalshy",
    title: "Loyalshy — Digital Loyalty Cards for Restaurants",
    description:
      "Create digital loyalty cards with Apple and Google Wallet passes. Boost repeat visits and reward your best customers.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Loyalshy — Digital Loyalty Cards for Restaurants",
    description:
      "Create digital loyalty cards with Apple and Google Wallet passes. Boost repeat visits and reward your best customers.",
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
          <Toaster richColors position="top-center" />
        </ThemeProvider>
        <AnalyticsProvider />
      </body>
    </html>
  );
}
