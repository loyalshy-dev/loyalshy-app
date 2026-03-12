"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { FadeIn } from "./motion"

const FAQ_ITEMS = [
  {
    id: "how-it-works",
    question: "How does Loyalshy work?",
    answer:
      "Loyalshy replaces paper punch cards with digital loyalty cards that live in your customers' Apple or Google Wallet. You set up your business, print a QR code, and customers scan it to get their digital pass. Staff register visits from the dashboard, and customers automatically earn rewards.",
  },
  {
    id: "devices-supported",
    question: "What devices are supported?",
    answer:
      "Loyalshy works with Apple Wallet (iPhone, Apple Watch) and Google Wallet (Android). The passes automatically update whenever a visit is registered — no app download required for customers.",
  },
  {
    id: "setup-time",
    question: "How long does setup take?",
    answer:
      "Most businesses are up and running in under 5 minutes. Create your account, customize your loyalty program, print your QR code, and you're ready to go.",
  },
  {
    id: "pass-types",
    question: "What types of passes can I create?",
    answer:
      "Loyalshy supports 10 pass types: stamp cards, coupons, memberships, points programs, prepaid cards, gift cards, tickets, access passes, transit passes, and business IDs. Each type has its own set of features and interactions.",
  },
  {
    id: "free-plan",
    question: "Is there a free plan?",
    answer:
      "Yes! Our Free plan lets you get started with up to 50 contacts and 1 stamp card program. No credit card required, free forever. Upgrade anytime when you need more.",
  },
  {
    id: "cancel",
    question: "How do I cancel?",
    answer:
      "You can cancel your subscription at any time from your billing settings. There are no long-term contracts or cancellation fees.",
  },
  {
    id: "security",
    question: "Is my data secure?",
    answer:
      "Yes. We use industry-standard encryption, secure authentication, and your data is stored on enterprise-grade infrastructure. We never share your customer data with third parties.",
  },
  {
    id: "customization",
    question: "Can I customize the loyalty card design?",
    answer:
      "Yes! Our visual studio lets you upload your logo, set brand colors, choose patterns, and fully customize how your wallet passes look. Every pass matches your business's identity.",
  },
] as const

export function FAQ() {
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
              FAQ
            </p>
            <h2
              className="text-3xl sm:text-[2.5rem] font-bold mb-4"
              style={{
                color: "var(--mk-text)",
                letterSpacing: "-0.03em",
              }}
            >
              Frequently asked questions
            </h2>
            <p
              className="text-[16px]"
              style={{ color: "var(--mk-text-muted)" }}
            >
              Everything you need to know about Loyalshy
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mk-card-glass overflow-hidden">
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="border-b-0 px-6"
                  style={
                    i < FAQ_ITEMS.length - 1
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
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-[14px] leading-relaxed pb-5 pt-0"
                    style={{ color: "var(--mk-text-muted)" }}
                  >
                    {item.answer}
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
            Still have questions?{" "}
            <a
              href="mailto:hello@loyalshy.com"
              className="font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
              style={{ color: "var(--mk-text)" }}
            >
              Email us
            </a>{" "}
            — we typically reply within a few hours.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
