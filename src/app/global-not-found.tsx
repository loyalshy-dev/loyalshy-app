import type { Metadata } from "next"
import Link from "next/link"
import { setRequestLocale } from "next-intl/server"
import { RootDocument } from "@/components/root-document"
import { defaultLocale } from "@/i18n/config"
import messages from "@/messages/en.json"

// 404 for URLs outside both root layouts ((app) and [locale]) — e.g. /foo,
// which [locale] rejects as an unknown locale. Enabled by
// experimental.globalNotFound in next.config.ts. Rendered statically in
// English — setRequestLocale keeps next-intl from reading the request.

export const metadata: Metadata = {
  title: "404 — Loyalshy",
  robots: { index: false, follow: false },
}

export default function GlobalNotFound() {
  setRequestLocale(defaultLocale)
  const t = messages.errors.notFound

  return (
    <RootDocument locale={defaultLocale} messages={messages}>
      <div className="flex min-h-svh items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-6xl font-bold text-muted-foreground/30">{t.code}</div>
          <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.message}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t.goHome}
          </Link>
        </div>
      </div>
    </RootDocument>
  )
}
