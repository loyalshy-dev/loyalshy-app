"use client"

import { useId, useRef, useState, type KeyboardEvent } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { PhoneFrame } from "./phone-frame"
import { SectionHeading } from "./section-heading"

// The owner's side: four screens of the dashboard. On desktop the list of
// screens sits on the left axis with the active one's description open;
// on phones the same list becomes chips above a phone. Both layouts are
// in the HTML and CSS picks one, so the server and the client agree.

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
  const uid = useId()
  const tabRefs = useRef<Partial<Record<ScreenId, HTMLButtonElement>>>({})
  const tabId = (id: ScreenId) => `${uid}-tab-${id}`
  const panelId = `${uid}-panel`

  // The tabs pattern: Tab lands on the active tab, arrows move between them.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    const index = SCREENS.findIndex((s) => s.id === active)
    let next: number | null = null
    if (e.key in keys) next = (index + keys[e.key] + SCREENS.length) % SCREENS.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = SCREENS.length - 1
    if (next === null) return
    e.preventDefault()
    const id = SCREENS[next].id
    setActive(id)
    tabRefs.current[id]?.focus()
  }

  return (
    <section id="features" className="scroll-mt-24" style={{ background: "var(--mk-bg)" }}>
      <div className="mk-wrap py-20 lg:py-28">
        <SectionHeading title={t("title")} lead={t("lead")} align="center" />

        <div className="mt-10 grid grid-cols-1 gap-8 lg:mt-14 lg:grid-cols-12 lg:gap-10">
          {/* Screen list */}
          <div className="lg:col-span-4">
            <div role="tablist" aria-label={t("title")} aria-orientation="horizontal" className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0">
              {SCREENS.map((screen) => {
                const isActive = active === screen.id
                return (
                  <button
                    key={screen.id}
                    ref={(el) => {
                      tabRefs.current[screen.id] = el ?? undefined
                    }}
                    id={tabId(screen.id)}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={panelId}
                    tabIndex={isActive ? 0 : -1}
                    data-active={isActive}
                    onClick={() => setActive(screen.id)}
                    onKeyDown={onKeyDown}
                    className="shrink-0 rounded-full bg-(--mk-surface) px-4 py-2 text-left text-[14px] font-medium text-(--mk-text) transition-colors data-[active=true]:bg-(--mk-text) data-[active=true]:text-(--mk-bg) lg:w-full lg:rounded-none lg:border-t lg:border-(--mk-border) lg:bg-transparent lg:px-0 lg:py-5 lg:text-base lg:text-(--mk-text-dimmed) lg:data-[active=true]:bg-transparent lg:data-[active=true]:text-(--mk-text)"
                  >
                    <span className="block font-semibold tracking-[-0.012em]">{t(`tabs.${screen.id}.label`)}</span>
                    <span
                      className="mk-body hidden overflow-hidden transition-[max-height,opacity,margin] duration-300 lg:block"
                      style={{
                        maxHeight: isActive ? 120 : 0,
                        opacity: isActive ? 1 : 0,
                        marginTop: isActive ? 6 : 0,
                        color: "var(--mk-text-muted)",
                      }}
                    >
                      {t(`tabs.${screen.id}.description`)}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mk-body mt-4 lg:hidden" style={{ color: "var(--mk-text-muted)" }}>
              {t(`tabs.${active}.description`)}
            </p>
          </div>

          {/* Screen */}
          <div id={panelId} role="tabpanel" aria-labelledby={tabId(active)} className="lg:col-span-8">
            {/* Phones: the screen inside the phone */}
            <div className="flex justify-center lg:hidden">
              <PhoneFrame width={260} status={false}>
                {SCREENS.map((screen) => (
                  <Image
                    key={screen.id}
                    src={screen.mobileImage}
                    alt={t(`tabs.${screen.id}.alt`)}
                    aria-hidden={active !== screen.id}
                    width={1170}
                    height={2532}
                    className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300"
                    style={{ opacity: active === screen.id ? 1 : 0 }}
                    sizes="260px"
                    loading="lazy"
                  />
                ))}
              </PhoneFrame>
            </div>
            {/* Desktop: the screen in a browser frame */}
            <div
              className="hidden overflow-hidden rounded-2xl lg:block"
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
                    src={screen.image}
                    alt={t(`tabs.${screen.id}.alt`)}
                    aria-hidden={active !== screen.id}
                    fill
                    className="object-cover object-top transition-opacity duration-300"
                    style={{ opacity: active === screen.id ? 1 : 0 }}
                    sizes="(max-width: 1280px) 66vw, 800px"
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
