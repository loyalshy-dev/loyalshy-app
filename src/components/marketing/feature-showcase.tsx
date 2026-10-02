import { getTranslations } from "next-intl/server"
import { PanelMock } from "./panel-mock"
import { SectionHeading } from "./section-heading"

// The owner's side, in one screen: the panel as it is, built from the
// product's own blocks with Café Sol's numbers. Title and lead only; the
// picture does the rest.

export async function FeatureShowcase() {
  const t = await getTranslations("featureShowcase")
  return (
    <section id="features" className="scroll-mt-24" style={{ background: "var(--mk-bg)" }}>
      <div className="mk-wrap py-20 lg:py-28">
        <SectionHeading title={t("title")} lead={t("lead")} align="center" />
        <div className="mt-10 lg:mt-14">
          <PanelMock />
        </div>
      </div>
    </section>
  )
}
