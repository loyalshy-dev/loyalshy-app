import { QrCode, RefreshCw, Wallet } from "lucide-react"
import Link from "next/link"
import { PhoneMockupInteractive } from "./phone-mockup"
import { FadeIn } from "./motion"
import type { MarketingCard } from "./wallet-card-data"
import type { WalletPassDesign } from "@/components/wallet-pass-renderer"

const bullets = [
  {
    icon: Wallet,
    text: "Works with Apple & Google Wallet",
  },
  {
    icon: RefreshCw,
    text: "Updates automatically on every visit",
  },
  {
    icon: QrCode,
    text: "One scan to join, no app required",
  },
] as const

type WalletPreviewProps = {
  showcaseCards?: MarketingCard[]
  showcaseDesigns?: WalletPassDesign[]
}

export function WalletPreview({ showcaseCards, showcaseDesigns }: WalletPreviewProps = {}) {
  return (
    <section
      id="customer-view"
      className="py-24 sm:py-32"
      style={{ background: "var(--mk-bg)" }}
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-x-20">
          {/* Phone mockup */}
          <FadeIn direction="right" delay={0.2} className="flex justify-center lg:order-last">
            <PhoneMockupInteractive cards={showcaseCards} designs={showcaseDesigns} />
          </FadeIn>

          {/* Text column */}
          <FadeIn direction="left" className="mt-12 lg:mt-0">
            <p
              className="text-[13px] font-medium uppercase tracking-widest"
              style={{ color: "var(--mk-brand-purple)" }}
            >
              The customer experience
            </p>
            <h2
              className="mt-3 text-3xl font-bold sm:text-[2.5rem]"
              style={{ color: "var(--mk-text)", letterSpacing: "-0.03em" }}
            >
              Beautiful passes that live in their wallet
            </h2>
            <p
              className="mt-5 text-[16px] leading-relaxed"
              style={{ color: "var(--mk-text-muted)" }}
            >
              No app to download. No account to create. Your customers scan once
              and get a loyalty card that lives right next to their boarding
              passes&nbsp;&mdash; and updates automatically every visit.
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
                See pricing &rarr;
              </Link>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
