import Link from "next/link"
import type { ReactNode } from "react"

// The opener of a secondary page: the title on the left axis, the lead
// under it, the one coral button and a plain second action, and the
// picture (or the product) on the right. On phones the picture follows
// the text.

export type Cta = { label: string; href: string }

export function PageHero({
  title,
  lead,
  primary,
  secondary,
  note,
  media,
  mediaClassName,
}: {
  title: string
  lead: string
  primary?: Cta
  secondary?: Cta
  note?: string
  media?: ReactNode
  mediaClassName?: string
}) {
  return (
    <section style={{ background: "var(--mk-bg)" }}>
      <div className="mk-wrap grid grid-cols-1 gap-10 pt-12 pb-14 lg:grid-cols-12 lg:items-center lg:gap-8 lg:pt-20 lg:pb-24">
        <div className={media ? "lg:col-span-6" : "lg:col-span-8"}>
          <h1 className="font-display mk-display-1 max-w-[14ch]" style={{ color: "var(--mk-text)" }}>
            {title}
          </h1>
          <p className="mk-lead mt-5 max-w-[48ch]">{lead}</p>
          {primary || secondary ? (
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              {primary ? (
                <Link href={primary.href} className="mk-btn-primary px-8! py-4! text-base!">
                  {primary.label}
                </Link>
              ) : null}
              {secondary ? (
                <Link href={secondary.href} className="text-base font-semibold underline-offset-4 hover:underline" style={{ color: "var(--mk-text)" }}>
                  {secondary.label}
                </Link>
              ) : null}
            </div>
          ) : null}
          {note ? (
            <p className="mk-body-sm mt-4" style={{ color: "var(--mk-text-dimmed)" }}>
              {note}
            </p>
          ) : null}
        </div>
        {media ? <div className={["lg:col-span-6", mediaClassName].filter(Boolean).join(" ")}>{media}</div> : null}
      </div>
    </section>
  )
}
