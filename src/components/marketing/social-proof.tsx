import { getTranslations } from "next-intl/server"

export async function SocialProof() {
  const t = await getTranslations("socialProof")

  return (
    <section
      className="py-10 sm:py-12"
      style={{
        background: "var(--mk-bg)",
        borderTop: "1px solid var(--mk-border)",
        borderBottom: "1px solid var(--mk-border)",
      }}
    >
      <div className="hero-fade-in" style={{ animationDelay: "400ms" }}>
        <p
          className="text-center text-[13px] font-medium uppercase tracking-widest"
          style={{ color: "var(--mk-text-dimmed)" }}
        >
          {t("headline")}
        </p>
      </div>
    </section>
  )
}
