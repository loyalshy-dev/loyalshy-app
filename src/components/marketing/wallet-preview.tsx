import { QrCode, RefreshCw, Wallet } from "lucide-react"
import Link from "next/link"
import { PhoneMockupInteractive } from "./phone-mockup"

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

export function WalletPreview() {
  return (
    <section id="customer-view" className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-x-20">
          {/* Phone mockup — shows first on mobile */}
          <div className="flex justify-center lg:order-last">
            <PhoneMockupInteractive />
          </div>

          {/* Text column */}
          <div className="mt-12 lg:mt-0">
            <p className="text-[13px] font-medium uppercase tracking-widest text-brand">
              The customer experience
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Beautiful passes that live in their wallet
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
              No app to download. No account to create. Your customers scan once
              and get a loyalty card that lives right next to their boarding
              passes&nbsp;&mdash; and updates automatically every visit.
            </p>

            {/* Feature bullets */}
            <ul className="mt-8 space-y-4">
              {bullets.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.text} className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                      <Icon className="size-4 text-brand" strokeWidth={1.5} />
                    </div>
                    <span className="text-[13px] font-medium text-foreground">
                      {item.text}
                    </span>
                  </li>
                )
              })}
            </ul>

            {/* CTA */}
            <div className="mt-10">
              <Link
                href="#pricing"
                className="text-[13px] font-medium text-brand hover:text-brand/80 transition-colors"
              >
                See pricing &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
