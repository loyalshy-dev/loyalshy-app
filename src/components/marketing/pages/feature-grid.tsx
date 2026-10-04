import Link from "next/link"

// Short items in columns, each under its own hairline. For "what else the
// card does" and "what stays the same" lists. An optional link per item.

export type FeatureItem = { title: string; body: string; meta?: string; link?: { label: string; href: string } }

export function FeatureGrid({ items, columns = 3 }: { items: FeatureItem[]; columns?: 2 | 3 | 4 }) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns]
  return (
    <ul className={`grid grid-cols-1 gap-x-8 gap-y-10 ${cols}`} role="list">
      {items.map((item) => (
        <li key={item.title} className="border-t pt-5" style={{ borderColor: "var(--mk-border)" }}>
          {item.meta ? (
            <p className="mk-caption mb-2 font-medium" style={{ color: "var(--mk-text-dimmed)" }}>
              {item.meta}
            </p>
          ) : null}
          <h3 className="mk-title-4" style={{ color: "var(--mk-text)" }}>
            {item.title}
          </h3>
          <p className="mk-body-sm mt-2 max-w-[40ch]" style={{ color: "var(--mk-text-muted)" }}>
            {item.body}
          </p>
          {item.link ? (
            <Link href={item.link.href} className="mk-body-sm mt-3 inline-block font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
              {item.link.label}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
