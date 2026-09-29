import type { ReactNode } from "react"

/**
 * Left-aligned section opener. The title sits on the page's left axis; an
 * optional lead runs under it at a readable measure. No eyebrow, no centering.
 */
export function SectionHeading({
  title,
  lead,
  id,
  children,
  className,
  align = "left",
}: {
  title: string
  lead?: string
  id?: string
  children?: ReactNode
  className?: string
  /** `center` for a full-width chapter opener, `left` beside a column of content. */
  align?: "left" | "center"
}) {
  const centered = align === "center"
  return (
    <div className={[className, centered ? "flex flex-col items-center text-center" : ""].filter(Boolean).join(" ")}>
      <h2
        id={id}
        className="font-display mk-display-2 max-w-[22ch]"
        style={{ color: "var(--mk-text)" }}
      >
        {title}
      </h2>
      {lead ? <p className="mk-lead mt-4 max-w-[52ch]">{lead}</p> : null}
      {children}
    </div>
  )
}
