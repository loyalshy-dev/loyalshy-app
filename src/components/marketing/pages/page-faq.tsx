"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { SectionHeading } from "@/components/marketing/section-heading"

// The landing's FAQ, fed with a page's own questions. Answers stay in the
// server HTML (forceMount) so crawlers read them; closed ones hide with CSS.

export type FaqItem = { question: string; answer: string }

export function PageFAQ({ title, items, aside }: { title: string; items: FaqItem[]; aside?: React.ReactNode }) {
  return (
    <section id="faq" className="scroll-mt-24" style={{ background: "var(--mk-bg)" }}>
      <div className="mk-wrap grid grid-cols-1 gap-10 py-20 lg:grid-cols-12 lg:gap-8 lg:py-28">
        <div className="lg:col-span-4">
          <SectionHeading title={title} />
          {aside ? (
            <div className="mt-6 mk-body" style={{ color: "var(--mk-text-muted)" }}>
              {aside}
            </div>
          ) : null}
        </div>
        <div className="lg:col-span-8">
          <Accordion type="single" collapsible className="w-full border-t" style={{ borderColor: "var(--mk-border)" }}>
            {items.map((item, i) => (
              <AccordionItem key={item.question} value={`q${i}`} className="border-b" style={{ borderColor: "var(--mk-border)" }}>
                <AccordionTrigger className="mk-body py-5 text-left font-semibold hover:no-underline" style={{ color: "var(--mk-text)" }}>
                  {item.question}
                </AccordionTrigger>
                <AccordionContent forceMount className="max-w-[65ch] pb-6 mk-body in-data-[state=closed]:hidden" style={{ color: "var(--mk-text-muted)" }}>
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
