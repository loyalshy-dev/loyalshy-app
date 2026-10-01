import { getTranslations } from "next-intl/server"
import { PanelMock } from "./panel-mock"
import { SectionHeading } from "./section-heading"

// The owner's side, in one screen: the panel as it is, built from the
// product's own blocks with Café Sol's numbers, and three lines under it
// for what else the panel does (the designer, the distribution).

const POINTS = ["dashboard", "cardDesigner", "distribution"] as const

export async function FeatureShowcase() {
  const t = await getTranslations("featureShowcase")
  return (
    <section id="features" className="scroll-mt-24" style={{ background: "var(--mk-bg)" }}>
      <div className="mk-wrap py-20 lg:py-28">
        <SectionHeading title={t("title")} lead={t("lead")} align="center" />
        <div className="mt-10 lg:mt-14">
          <PanelMock />
        </div>
        <dl className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3 lg:mt-14 lg:gap-10">
          {POINTS.map((key) => (
            <div key={key}>
              <dt className="mk-title-4" style={{ color: "var(--mk-text)" }}>{t(`tabs.${key}.label`)}</dt>
              <dd className="mk-body mt-2 max-w-[40ch]" style={{ color: "var(--mk-text-muted)" }}>{t(`tabs.${key}.description`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
