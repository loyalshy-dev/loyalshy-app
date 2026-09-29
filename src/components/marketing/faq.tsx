"use client"

import { useTranslations } from "next-intl"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { SectionHeading } from "./section-heading"

const FAQ_ITEM_KEYS = ["howWorks", "paper", "devices", "pos", "freePlan", "security", "enterprise"] as const

export function FAQ() {
  const t = useTranslations("faq")

  return (
    <section id="faq" className="scroll-mt-24" style={{ background: "var(--mk-bg)" }}>
      <div className="mk-wrap grid grid-cols-1 gap-10 py-20 lg:grid-cols-12 lg:gap-8 lg:py-28">
        <div className="lg:col-span-4">
          <SectionHeading title={t("title")} />
          <p className="mt-6 mk-body" style={{ color: "var(--mk-text-muted)" }}>
            {t("stillHaveQuestions")}{" "}
            <a
              href="mailto:hello@loyalshy.com"
              className="font-medium underline underline-offset-4"
              style={{ color: "var(--mk-text)" }}
            >
              {t("emailUs")}
            </a>{" "}
            {t("replyTime")}
          </p>
        </div>
        <div className="lg:col-span-8">
          <Accordion type="single" collapsible className="w-full border-t" style={{ borderColor: "var(--mk-border)" }}>
            {FAQ_ITEM_KEYS.map((key) => (
              <AccordionItem key={key} value={key} className="border-b" style={{ borderColor: "var(--mk-border)" }}>
                <AccordionTrigger
                  className="mk-body py-5 text-left font-semibold hover:no-underline"
                  style={{ color: "var(--mk-text)" }}
                >
                  {t(`items.${key}.question`)}
                </AccordionTrigger>
                <AccordionContent className="max-w-[65ch] pb-6 mk-body" style={{ color: "var(--mk-text-muted)" }}>
                  {t(`items.${key}.answer`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
