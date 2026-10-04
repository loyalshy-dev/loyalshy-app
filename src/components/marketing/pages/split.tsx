import type { ReactNode } from "react"
import Link from "next/link"

// A chapter told in rows: text on one side, the picture on the other,
// sides alternating. Each row can carry a small line above the title
// (which plan it needs, which phones it reaches) and a link under the body.

export type SplitRow = {
  id?: string
  meta?: string
  title: string
  body: string
  /** Optional second paragraph. */
  more?: string
  link?: { label: string; href: string }
  media: ReactNode
}

export function SplitRows({ rows, startReversed = false }: { rows: SplitRow[]; startReversed?: boolean }) {
  return (
    <div className="flex flex-col gap-16 lg:gap-28">
      {rows.map((row, i) => {
        const reversed = startReversed ? i % 2 === 0 : i % 2 === 1
        return (
          <div key={row.id ?? row.title} id={row.id} className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-8 scroll-mt-24">
            <div className={reversed ? "lg:col-span-5 lg:col-start-8 lg:order-2" : "lg:col-span-5"}>
              {row.meta ? (
                <p className="mk-caption font-medium" style={{ color: "var(--mk-text-dimmed)" }}>
                  {row.meta}
                </p>
              ) : null}
              <h3 className="font-display mk-display-2 mt-2 max-w-[18ch]" style={{ color: "var(--mk-text)" }}>
                {row.title}
              </h3>
              <p className="mk-body mt-5 max-w-[52ch]" style={{ color: "var(--mk-text-muted)" }}>
                {row.body}
              </p>
              {row.more ? (
                <p className="mk-body mt-4 max-w-[52ch]" style={{ color: "var(--mk-text-muted)" }}>
                  {row.more}
                </p>
              ) : null}
              {row.link ? (
                <Link href={row.link.href} className="mk-body mt-6 inline-block font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
                  {row.link.label}
                </Link>
              ) : null}
            </div>
            <div className={reversed ? "lg:col-span-6 lg:col-start-1 lg:order-1" : "lg:col-span-6 lg:col-start-7"}>{row.media}</div>
          </div>
        )
      })}
    </div>
  )
}
