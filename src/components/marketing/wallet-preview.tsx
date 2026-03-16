import Image from "next/image"
import { QrCode, RefreshCw, Wallet } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { FadeIn } from "./motion"

/* ─── Stacked pass cards ─────────────────────────────────────────── */

const PREVIEW_PASSES = [
  { src: "/pass-types/stamp.webp", alt: "Stamp card in Apple Wallet", rotate: -4, x: 20, y: 10, z: 1 },
  { src: "/pass-types/ticket.webp", alt: "Ticket pass in Google Wallet", rotate: 6, x: 100, y: -20, z: 2 },
  { src: "/pass-types/coupon.webp", alt: "Coupon pass in wallet", rotate: -2, x: 60, y: 80, z: 3 },
] as const

function WalletPassStack() {
  return (
    <div className="relative" style={{ width: 300, height: 360 }}>
      {PREVIEW_PASSES.map((pass) => (
        <div
          key={pass.src}
          className="absolute"
          style={{
            left: pass.x,
            top: pass.y,
            zIndex: pass.z,
            transform: `rotate(${pass.rotate}deg)`,
            animation: `mk-float ${3.5 + pass.z * 0.4}s ease-in-out infinite`,
            animationDelay: `${pass.z * -1}s`,
          }}
        >
          <Image
            src={pass.src}
            alt={pass.alt}
            width={180}
            height={202}
            className="rounded-2xl"
            style={{
              boxShadow: `0 ${6 + pass.z * 4}px ${20 + pass.z * 10}px oklch(0 0 0 / ${0.08 + pass.z * 0.02})`,
            }}
            loading="lazy"
          />
        </div>
      ))}
    </div>
  )
}

/* ─── Section ────────────────────────────────────────────────────── */

export async function WalletPreview() {
  const t = await getTranslations("walletPreview")

  const bullets = [
    { icon: Wallet, text: t("badge1") },
    { icon: RefreshCw, text: t("badge2") },
    { icon: QrCode, text: t("badge3") },
  ]

  return (
    <section
      id="customer-view"
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{ background: "var(--mk-bg)" }}
    >
      {/* Gradient mesh */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 50% 60% at 70% 40%, oklch(0.55 0.2 265 / 0.05) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 30% 60%, oklch(0.55 0.17 155 / 0.04) 0%, transparent 70%)
          `,
        }}
      />

      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-x-20">
          {/* Floating pass card images */}
          <FadeIn direction="right" delay={0.2} className="flex justify-center lg:order-last">
            <div className="relative">
              {/* Glow behind cards */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 scale-125 rounded-full blur-3xl"
                style={{
                  background: "radial-gradient(circle, oklch(0.55 0.2 265 / 0.08) 0%, transparent 70%)",
                }}
              />
              <WalletPassStack />
            </div>
          </FadeIn>

          {/* Text column */}
          <FadeIn direction="left" className="mt-12 lg:mt-0">
            <p
              className="text-[13px] font-medium uppercase tracking-widest"
              style={{ color: "var(--mk-brand-purple)" }}
            >
              {t("sectionLabel")}
            </p>
            <h2
              className="mt-3 text-3xl font-bold sm:text-[2.75rem]"
              style={{ color: "var(--mk-text)", letterSpacing: "-0.035em" }}
            >
              {t("title")}
            </h2>
            <p
              className="mt-5 text-[16px] leading-relaxed"
              style={{ color: "var(--mk-text-muted)" }}
            >
              {t("description")}
            </p>

            <ul className="mt-8 space-y-4">
              {bullets.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.text} className="flex items-center gap-3">
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: "oklch(0.55 0.2 265 / 0.06)",
                        border: "1px solid oklch(0.55 0.2 265 / 0.1)",
                      }}
                    >
                      <Icon
                        className="size-4"
                        strokeWidth={1.5}
                        style={{ color: "oklch(0.55 0.2 265)" }}
                      />
                    </div>
                    <span
                      className="text-[15px] font-medium"
                      style={{ color: "var(--mk-text)" }}
                    >
                      {item.text}
                    </span>
                  </li>
                )
              })}
            </ul>

            <div className="mt-10">
              <Link
                href="#pricing"
                className="text-[14px] font-medium transition-colors hover:opacity-70"
                style={{ color: "var(--mk-brand-purple)" }}
              >
                {t("seePricing")}
              </Link>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
