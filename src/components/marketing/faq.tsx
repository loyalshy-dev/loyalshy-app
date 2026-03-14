"use client"

import { useTranslations } from "next-intl"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { FadeIn } from "./motion"

const FAQ_ITEM_KEYS = [
  "howWorks",
  "devices",
  "setup",
  "passTypes",
  "freePlan",
  "cancel",
  "security",
  "customize",
] as const

export function FAQ() {
  const t = useTranslations("faq")

  return (
    <section
      id="faq"
      className="py-24 sm:py-32 px-4 sm:px-6"
      style={{ background: "var(--mk-surface)" }}
    >
      <div className="mx-auto max-w-3xl">
        <FadeIn>
          <div className="text-center mb-14">
            <p
              className="mb-3 inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-bold tracking-[0.08em] uppercase"
              style={{
                border: "1px solid var(--mk-border)",
                background: "var(--mk-card)",
                color: "var(--mk-text-dimmed)",
              }}
            >
              {t("sectionLabel")}
            </p>
            <h2
              className="text-3xl sm:text-[2.5rem] font-bold mb-4"
              style={{
                color: "var(--mk-text)",
                letterSpacing: "-0.03em",
              }}
            >
              {t("title")}
            </h2>
            <p
              className="text-[16px]"
              style={{ color: "var(--mk-text-muted)" }}
            >
              {t("subtitle")}
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mk-card-glass overflow-hidden">
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEM_KEYS.map((key, i) => (
                <AccordionItem
                  key={key}
                  value={key}
                  className="border-b-0 px-6"
                  style={
                    i < FAQ_ITEM_KEYS.length - 1
                      ? {
                          borderBottom: "1px solid var(--mk-border)",
                        }
                      : undefined
                  }
                >
                  <AccordionTrigger
                    className="text-[15px] font-medium hover:no-underline py-5 gap-6"
                    style={{ color: "var(--mk-text)" }}
                  >
                    {t(`items.${key}.question`)}
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-[14px] leading-relaxed pb-5 pt-0"
                    style={{ color: "var(--mk-text-muted)" }}
                  >
                    {t(`items.${key}.answer`)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p
            className="mt-8 text-center text-[14px]"
            style={{ color: "var(--mk-text-muted)" }}
          >
            {t("stillHaveQuestions")}{" "}
            <a
              href="mailto:hello@loyalshy.com"
              className="font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
              style={{ color: "var(--mk-text)" }}
            >
              {t("emailUs")}
            </a>{" "}
            {t("replyTime")}
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
