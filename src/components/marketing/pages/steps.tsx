// A numbered list on hairlines. `import Link` sits below the type on purpose: see
// the step's optional link.
//: the step's number in the margin, its
// title, and one sentence. Reads as a procedure, not as cards.

import Link from "next/link"

export type Step = { title: string; body: string; link?: { label: string; href: string } }

export function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="border-t" style={{ borderColor: "var(--mk-border)" }}>
      {steps.map((step, i) => (
        <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b py-6 lg:grid-cols-12 lg:gap-8 lg:py-8" style={{ borderColor: "var(--mk-border)" }}>
          <span className="font-display text-[1.3125rem] font-semibold tabular-nums leading-tight lg:col-span-1" style={{ color: "var(--mk-text-dimmed)" }}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="lg:col-span-4">
            <h3 className="mk-title-4" style={{ color: "var(--mk-text)" }}>
              {step.title}
            </h3>
          </div>
          <div className="col-start-2 mt-2 lg:col-span-7 lg:col-start-6 lg:mt-0">
            <p className="mk-body max-w-[56ch]" style={{ color: "var(--mk-text-muted)" }}>
              {step.body}
            </p>
            {step.link ? (
              <Link href={step.link.href} className="mk-body-sm mt-3 inline-block font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
                {step.link.label}
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
