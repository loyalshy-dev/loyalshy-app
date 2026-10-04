import type { ReactNode } from "react"
import { SectionHeading } from "@/components/marketing/section-heading"

// A chapter of a secondary page: the landing's rhythm, a heading on the
// left axis or centred as an opener, then its content.

export function PageSection({
  id,
  title,
  lead,
  align = "left",
  children,
  tight = false,
}: {
  id?: string
  title?: string
  lead?: string
  align?: "left" | "center"
  children: ReactNode
  tight?: boolean
}) {
  return (
    <section id={id} className="scroll-mt-24" style={{ background: "var(--mk-bg)" }}>
      <div className={`mk-wrap ${tight ? "py-12 lg:py-16" : "py-16 lg:py-24"}`}>
        {title ? <SectionHeading title={title} lead={lead} align={align} /> : null}
        <div className={title ? "mt-10 lg:mt-14" : ""}>{children}</div>
      </div>
    </section>
  )
}
