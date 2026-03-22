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
      className="py-32 px-4 sm:px-6"
      style={{ background: "var(--mk-bg)" }}
    >
      <div className="mx-auto max-w-3xl">
        <FadeIn>
          <div className="text-center mb-16">
            <h2
              className="mk-clamp-h2 font-black tracking-tight"
              style={{ color: "var(--mk-text)" }}
            >
              {t("title")}
            </h2>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="flex flex-col gap-4">
            <Accordion type="single" collapsible className="w-full flex flex-col gap-4">
              {FAQ_ITEM_KEYS.map((key) => (
                <AccordionItem
                  key={key}
                  value={key}
                  className="mk-card-glass px-6 rounded-2xl! border-b-0"
                >
                  <AccordionTrigger
                    className="text-[15px] font-bold hover:no-underline py-5 gap-6"
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
