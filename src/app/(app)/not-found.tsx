import Link from "next/link"
import { getTranslations } from "next-intl/server"

export default async function NotFound() {
  const t = await getTranslations("errors.notFound")

  return (
    <div className="flex min-h-svh items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="text-6xl font-bold text-muted-foreground/30">{t("code")}</div>
        <h1 className="text-xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("message")}
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("goHome")}
        </Link>
      </div>
    </div>
  )
}
