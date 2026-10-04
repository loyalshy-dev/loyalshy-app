import { getTranslations } from "next-intl/server"
import { PageFAQ } from "./pages/page-faq"

const FAQ_ITEM_KEYS = ["howWorks", "paper", "devices", "pos", "freePlan", "security", "enterprise"] as const

// The landing's questions, on the same accordion the secondary pages use
// (answers stay in the server HTML for crawlers).
export async function FAQ() {
  const t = await getTranslations("faq")

  return (
    <PageFAQ
      title={t("title")}
      items={FAQ_ITEM_KEYS.map((key) => ({ question: t(`items.${key}.question`), answer: t(`items.${key}.answer`) }))}
      aside={
        <p>
          {t("stillHaveQuestions")}{" "}
          <a href="mailto:hello@loyalshy.com" className="font-medium underline underline-offset-4" style={{ color: "var(--mk-text)" }}>
            {t("emailUs")}
          </a>{" "}
          {t("replyTime")}
        </p>
      }
    />
  )
}
