"use client"

import { useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { PhoneFrame } from "./phone-frame"
import { useMediaQuery } from "./use-media-query"
import { SectionHeading } from "./section-heading"

// The owner's side: four screens of the dashboard. On desktop the list of
// screens sits on the left axis with the active one's description open;
// on phones the same list becomes chips above a phone.

const SCREENS = [
  { id: "dashboard", image: "/platform/desktop/dashboard.webp", mobileImage: "/platform/mobile/dashboard.webp" },
  { id: "cardDesigner", image: "/platform/desktop/studio.webp", mobileImage: "/platform/mobile/studio.webp" },
  { id: "distribution", image: "/platform/desktop/distribution.webp", mobileImage: "/platform/mobile/distribution.webp" },
  { id: "team", image: "/platform/desktop/team.webp", mobileImage: "/platform/mobile/team.webp" },
] as const

type ScreenId = (typeof SCREENS)[number]["id"]

export function FeatureShowcase() {
  const t = useTranslations("featureShowcase")
  const [active, setActive] = useState<ScreenId>("dashboard")
  const compact = useMediaQuery("(max-width: 1023px)")

  return (
    <section id="features" className="scroll-mt-24" style={{ background: "var(--mk-bg)" }}>
      <div className="mk-wrap py-20 lg:py-28">
        <SectionHeading title={t("title")} lead={t("lead")} align="center" />

        <div className="mt-10 grid grid-cols-1 gap-8 lg:mt-14 lg:grid-cols-12 lg:gap-10">
          {/* Screen list */}
          <div className="lg:col-span-4" role="tablist" aria-label={t("title")}>
            <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0">
              {SCREENS.map((screen) => {
                const isActive = active === screen.id
                return (
                  <button
                    key={screen.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`screen-${screen.id}`}
                    onClick={() => setActive(screen.id)}
                    className="shrink-0 rounded-full px-4 py-2 text-left text-[14px] font-medium transition-colors lg:w-full lg:rounded-none lg:border-t lg:px-0 lg:py-5 lg:text-base"
                    style={{
                      background: compact ? (isActive ? "var(--mk-text)" : "var(--mk-surface)") : "transparent",
                      color: compact ? (isActive ? "var(--mk-bg)" : "var(--mk-text)") : isActive ? "var(--mk-text)" : "var(--mk-text-dimmed)",
                      borderColor: "var(--mk-border)",
                    }}
                  >
                    <span className="block font-semibold tracking-[-0.012em]">{t(`tabs.${screen.id}.label`)}</span>
                    {!compact && (
                      <span
                        className="block overflow-hidden mk-body transition-[max-height,opacity,margin] duration-300"
                        style={{
                          maxHeight: isActive ? 120 : 0,
                          opacity: isActive ? 1 : 0,
                          marginTop: isActive ? 6 : 0,
                          color: "var(--mk-text-muted)",
                        }}
                      >
                        {t(`tabs.${screen.id}.description`)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {compact && (
              <p className="mt-4 mk-body" style={{ color: "var(--mk-text-muted)" }}>
                {t(`tabs.${active}.description`)}
              </p>
            )}
          </div>

          {/* Screen */}
          <div className="lg:col-span-8">
            {compact ? (
              <div className="flex justify-center">
                <PhoneFrame width={260} status={false}>
                  {SCREENS.map((screen) => (
                    <Image
                      key={screen.id}
                      id={`screen-${screen.id}`}
                      src={screen.mobileImage}
                      alt={t(`tabs.${screen.id}.alt`)}
                      width={780}
                      height={1688}
                      className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300"
                      style={{ opacity: active === screen.id ? 1 : 0 }}
                      sizes="260px"
                      loading={screen.id === "dashboard" ? "eager" : "lazy"}
                    />
                  ))}
                </PhoneFrame>
              </div>
            ) : (
              <div
                className="overflow-hidden rounded-2xl"
                style={{ border: "1px solid var(--mk-border)", background: "var(--mk-card)" }}
              >
                <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ borderBottom: "1px solid var(--mk-border)" }}>
                  <span className="size-2.5 rounded-full" style={{ background: "var(--mk-border)" }} />
                  <span className="size-2.5 rounded-full" style={{ background: "var(--mk-border)" }} />
                  <span className="size-2.5 rounded-full" style={{ background: "var(--mk-border)" }} />
                  <span className="ml-3 text-[12px]" style={{ color: "var(--mk-text-dimmed)" }}>
                    {t("browserUrl")}
                  </span>
                </div>
                <div className="relative aspect-[2506/1480]">
                  {SCREENS.map((screen) => (
                    <Image
                      key={screen.id}
                      id={`screen-${screen.id}`}
                      src={screen.image}
                      alt={t(`tabs.${screen.id}.alt`)}
                      fill
                      className="object-cover object-top transition-opacity duration-300"
                      style={{ opacity: active === screen.id ? 1 : 0 }}
                      sizes="(max-width: 1280px) 66vw, 800px"
                      loading={screen.id === "dashboard" ? "eager" : "lazy"}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
