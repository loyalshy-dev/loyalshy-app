import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { getLocale, getMessages } from "next-intl/server";
import { RootDocument, baseMetadata, rootViewport } from "@/components/root-document";

// Root layout for the app (dashboard, auth, studio, admin, join pages).
// Locale comes from the `locale` cookie / Accept-Language (src/i18n/request.ts).
// The marketing site has its own root layout at src/app/[locale]/layout.tsx.

export const viewport: Viewport = rootViewport;

export const metadata: Metadata = {
  ...baseMetadata,
  title: {
    default: "Loyalshy — Digital Loyalty Cards for Small Businesses",
    template: "%s — Loyalshy",
  },
  description:
    "Replace paper stamp cards with digital ones in Apple and Google Wallet. Reward repeat customers with stamp cards and coupons — no app required.",
};

async function IntlDocument({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <RootDocument locale={locale} messages={messages}>
      {children}
    </RootDocument>
  );
}

export default function AppRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense>
      <IntlDocument>{children}</IntlDocument>
    </Suspense>
  );
}
