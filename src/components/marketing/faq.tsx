"use client"

// Usage:
// import { FAQ } from "@/components/marketing/faq"
// <FAQ /> — drop into any landing page section

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    id: "how-it-works",
    question: "How does Fidelio work?",
    answer:
      "Fidelio replaces paper punch cards with digital loyalty cards that live in your customers' Apple or Google Wallet. You set up your restaurant, print a QR code, and customers scan it to get their digital pass. Staff register visits from the dashboard, and customers automatically earn rewards.",
  },
  {
    id: "devices-supported",
    question: "What devices are supported?",
    answer:
      "Fidelio works with Apple Wallet (iPhone, Apple Watch) and Google Wallet (Android). The passes automatically update whenever a visit is registered — no app download required for customers.",
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
      "Absolutely! The Starter plan comes with a 14-day free trial. No credit card required to start. You can also use the Free plan indefinitely with up to 50 customers.",
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

// ─── FAQ Section ──────────────────────────────────────────────────────────────

export function FAQ() {
  return (
    <section
      id="faq"
      className="py-24 px-4 sm:px-6"
      style={{ background: "var(--background)" }}
    >
      <div className="mx-auto max-w-3xl">
        {/* Heading */}
        <div className="text-center mb-12">
          <p className="mb-3 inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--muted)] px-3 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--muted-foreground)]">
            FAQ
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--foreground)] mb-4">
            Frequently asked questions
          </h2>
          <p className="text-[15px] text-[var(--muted-foreground)]">
            Everything you need to know about Fidelio.
          </p>
        </div>

        {/* Accordion */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden divide-y divide-[var(--border)]">
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                // Override default border-b since we use divide on parent
                className="border-b-0 px-6"
              >
                <AccordionTrigger className="text-[13px] font-medium text-[var(--foreground)] hover:no-underline py-5 gap-6">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-[13px] text-[var(--muted-foreground)] leading-relaxed pb-5 pt-0">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Still have questions nudge */}
        <p className="mt-8 text-center text-[13px] text-[var(--muted-foreground)]">
          Still have questions?{" "}
          <a
            href="mailto:hello@fidelio.app"
            className="font-medium text-[var(--foreground)] underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            Email us
          </a>{" "}
          — we typically reply within a few hours.
        </p>
      </div>
    </section>
  )
}
