import { FadeIn } from "./motion"

export function SocialProof() {
  return (
    <section
      className="py-10 sm:py-12"
      style={{
        background: "var(--mk-bg)",
        borderTop: "1px solid var(--mk-border)",
        borderBottom: "1px solid var(--mk-border)",
      }}
    >
      <FadeIn>
        <p
          className="text-center text-[13px] font-medium uppercase tracking-[0.1em]"
          style={{ color: "var(--mk-text-dimmed)" }}
        >
          Powering digital wallet passes for businesses worldwide
        </p>
      </FadeIn>
    </section>
  )
}
