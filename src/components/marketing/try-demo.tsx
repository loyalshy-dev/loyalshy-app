import Image from "next/image"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { FadeIn } from "./motion"

const DEMO_JOIN_URL = process.env.NEXT_PUBLIC_DEMO_JOIN_URL

export async function TryDemo() {
  if (!DEMO_JOIN_URL) return null

  const t = await getTranslations("tryDemo")

  return (
    <section
      id="try-demo"
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{ background: "var(--mk-surface)" }}
    >
      {/* Gradient mesh */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 50% 50% at 50% 40%, oklch(0.55 0.2 265 / 0.05) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 70% 70%, oklch(0.55 0.17 155 / 0.04) 0%, transparent 70%)
          `,
        }}
      />

      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center mb-12 sm:mb-16">
            <p
              className="text-[13px] font-medium uppercase tracking-widest mb-3"
              style={{ color: "var(--mk-brand-purple)" }}
            >
              {t("sectionLabel")}
            </p>
            <h2
              className="text-3xl sm:text-[2.75rem] font-bold"
              style={{ color: "var(--mk-text)", letterSpacing: "-0.035em" }}
            >
              {t("title")}
            </h2>
            <p
              className="mt-4 text-[16px] leading-relaxed"
              style={{ color: "var(--mk-text-muted)" }}
            >
              {t("subtitle")}
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div
            className="mx-auto max-w-md flex flex-col items-center gap-8 rounded-2xl p-8 sm:p-10"
            style={{
              background: "var(--mk-card)",
              border: "1px solid var(--mk-border)",
              boxShadow: "0 4px 24px oklch(0 0 0 / 0.06)",
            }}
          >
            {/* Card preview */}
            <Image
              src="/pass-types/coupon.webp"
              alt={t("cardPreviewAlt")}
              width={283}
              height={308}
              className="rounded-2xl"

            />

            {/* Wallet buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                href={DEMO_JOIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("addToAppleWallet")}
              >
                <Image
                  src="/wallet-buttons/US-UK_Add_to_Apple_Wallet_RGB_101421.svg"
                  alt={t("addToAppleWallet")}
                  width={156}
                  height={48}
                  className="h-12 w-auto"
                />
              </Link>
              <Link
                href={DEMO_JOIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("addToGoogleWallet")}
              >
                <Image
                  src="/wallet-buttons/enGB_add_to_google_wallet_add-wallet-badge.svg"
                  alt={t("addToGoogleWallet")}
                  width={180}
                  height={48}
                  className="h-12 w-auto"
                />
              </Link>
            </div>

            {/* Fallback link */}
            <div className="flex items-center gap-2">
              <span
                className="text-[13px]"
                style={{ color: "var(--mk-text-dimmed)" }}
              >
                {t("or")}
              </span>
              <Link
                href={DEMO_JOIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-opacity hover:opacity-70"
                style={{ color: "var(--mk-brand-purple)" }}
              >
                {t("openJoinPage")}
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
