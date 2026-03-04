"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const FAQ_ITEMS = [
  {
    id: "how-it-works",
    question: "How does Loyalshy work?",
    answer:
      "Loyalshy replaces paper punch cards with digital loyalty cards that live in your customers' Apple or Google Wallet. You set up your restaurant, print a QR code, and customers scan it to get their digital pass. Staff register visits from the dashboard, and customers automatically earn rewards.",
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
      "Most restaurants are up and running in under 5 minutes. Create your account, customize your loyalty program, print your QR code, and you're ready to go.",
  },
  {
    id: "free-trial",
    question: "Can I try it for free?",
    answer:
      "Absolutely! The Starter plan comes with a 14-day free trial. No credit card required to start.",
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
      "Yes! You can upload your logo, set your brand colors, and customize the reward description. Your wallet passes will match your restaurant's identity.",
  },
  {
    id: "payment-methods",
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards through Stripe. Enterprise customers can arrange custom payment terms.",
  },
] as const

export function FAQ() {
  return (
    <section
      id="faq"
      className="py-24 px-4 sm:px-6"
      style={{ background: "var(--mk-bg)" }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <p
            className="mb-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase"
            style={{
              border: "1px solid var(--mk-border)",
              background: "var(--mk-surface)",
              color: "var(--mk-text-dimmed)",
            }}
          >
            FAQ
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold mb-4"
            style={{ color: "var(--mk-text)", letterSpacing: "-0.025em" }}
          >
            Frequently asked questions
          </h2>
          <p className="text-[15px]" style={{ color: "var(--mk-text-muted)" }}>
            Everything you need to know about Loyalshy.
          </p>
        </div>

        <div className="mk-card-glass overflow-hidden">
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="border-b-0 px-6"
                style={
                  i < FAQ_ITEMS.length - 1
                    ? { borderBottom: "1px solid var(--mk-border)" }
                    : undefined
                }
              >
                <AccordionTrigger
                  className="text-[13px] font-medium hover:no-underline py-5 gap-6"
                  style={{ color: "var(--mk-text)" }}
                >
                  {item.question}
                </AccordionTrigger>
                <AccordionContent
                  className="text-[13px] leading-relaxed pb-5 pt-0"
                  style={{ color: "var(--mk-text-muted)" }}
                >
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <p className="mt-8 text-center text-[13px]" style={{ color: "var(--mk-text-muted)" }}>
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
      </div>
    </section>
  )
}
