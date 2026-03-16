import { Code2, Webhook, BookOpen, ArrowRight } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { FadeIn } from "./motion"

/* ─── Code preview (right side) ──────────────────────────────────── */

function CodePreview({ t }: { t: (key: string) => string }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "oklch(0.13 0.005 285)",
        border: "1px solid oklch(0.25 0.008 285)",
        boxShadow:
          "0 8px 32px oklch(0 0 0 / 0.12), 0 2px 8px oklch(0 0 0 / 0.06)",
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid oklch(0.22 0.006 285)" }}
      >
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full" style={{ background: "oklch(0.65 0.18 25)" }} />
          <div className="size-2.5 rounded-full" style={{ background: "oklch(0.75 0.15 85)" }} />
          <div className="size-2.5 rounded-full" style={{ background: "oklch(0.65 0.17 155)" }} />
        </div>
        <span
          className="ml-2 text-[12px] font-mono"
          style={{ color: "oklch(0.5 0.01 285)" }}
        >
          {t("codePreview.filename")}
        </span>
      </div>

      {/* Code content */}
      <div className="p-5 overflow-x-auto">
        <pre className="text-[13px] leading-[1.7] font-mono">
          <code>
            <Line color="comment">{"// Issue a stamp card pass"}</Line>
            <Line color="keyword">{"const"}</Line>{" "}
            <span style={{ color: "oklch(0.75 0.12 220)" }}>response</span>{" "}
            <span style={{ color: "oklch(0.7 0.15 60)" }}>=</span>{" "}
            <Line color="keyword" inline>{"await"}</Line>{" "}
            <span style={{ color: "oklch(0.75 0.15 85)" }}>fetch</span>
            {"("}
            <span style={{ color: "oklch(0.7 0.14 145)" }}>{'"https://loyalshy.com/api/v1/passes"'}</span>
            {", {"}
            {"\n"}
            {"  "}
            <span style={{ color: "oklch(0.75 0.12 220)" }}>method</span>
            {": "}
            <span style={{ color: "oklch(0.7 0.14 145)" }}>{'"POST"'}</span>
            {","}
            {"\n"}
            {"  "}
            <span style={{ color: "oklch(0.75 0.12 220)" }}>headers</span>
            {": {"}
            {"\n"}
            {"    "}
            <span style={{ color: "oklch(0.7 0.14 145)" }}>{'"Authorization"'}</span>
            {": "}
            <span style={{ color: "oklch(0.7 0.14 145)" }}>{'"Bearer lsk_live_..."'}</span>
            {","}
            {"\n"}
            {"    "}
            <span style={{ color: "oklch(0.7 0.14 145)" }}>{'"Content-Type"'}</span>
            {": "}
            <span style={{ color: "oklch(0.7 0.14 145)" }}>{'"application/json"'}</span>
            {"\n"}
            {"  },"}
            {"\n"}
            {"  "}
            <span style={{ color: "oklch(0.75 0.12 220)" }}>body</span>
            {": "}
            <span style={{ color: "oklch(0.75 0.15 85)" }}>JSON</span>
            {"."}
            <span style={{ color: "oklch(0.75 0.15 85)" }}>stringify</span>
            {"({"}
            {"\n"}
            {"    "}
            <span style={{ color: "oklch(0.75 0.12 220)" }}>templateId</span>
            {": "}
            <span style={{ color: "oklch(0.7 0.14 145)" }}>{'"tmpl_abc123"'}</span>
            {","}
            {"\n"}
            {"    "}
            <span style={{ color: "oklch(0.75 0.12 220)" }}>contact</span>
            {": { "}
            <span style={{ color: "oklch(0.75 0.12 220)" }}>fullName</span>
            {": "}
            <span style={{ color: "oklch(0.7 0.14 145)" }}>{'"Sarah Chen"'}</span>
            {" },"}
            {"\n"}
            {"    "}
            <span style={{ color: "oklch(0.75 0.12 220)" }}>sendEmail</span>
            {": "}
            <span style={{ color: "oklch(0.7 0.15 60)" }}>true</span>
            {"\n"}
            {"  })"}
            {"\n"}
            {"});"}
          </code>
        </pre>
      </div>

      {/* Response hint */}
      <div
        className="px-5 py-3 text-[12px] font-mono"
        style={{
          color: "oklch(0.55 0.17 155)",
          borderTop: "1px solid oklch(0.22 0.006 285)",
        }}
      >
        {"→ 201 Created · walletUrls.appleWalletUrl, walletUrls.googleWalletUrl"}
      </div>
    </div>
  )
}

function Line({
  color,
  children,
  inline,
}: {
  color: "keyword" | "comment"
  children: React.ReactNode
  inline?: boolean
}) {
  const colors = {
    keyword: "oklch(0.7 0.15 300)",
    comment: "oklch(0.45 0.01 285)",
  }
  if (inline) return <span style={{ color: colors[color] }}>{children}</span>
  return <span style={{ color: colors[color] }}>{children}</span>
}

/* ─── Feature item (left side) ───────────────────────────────────── */

function FeatureItem({
  icon: Icon,
  title,
  description,
  isLast,
}: {
  icon: React.ElementType
  title: string
  description: string
  isLast?: boolean
}) {
  return (
    <div
      className={`py-6 ${!isLast ? "" : ""}`}
      style={!isLast ? { borderBottom: "1px solid var(--mk-border)" } : undefined}
    >
      <div className="flex items-start gap-3.5">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg mt-0.5"
          style={{
            background: "oklch(0.55 0.2 265 / 0.06)",
            border: "1px solid oklch(0.55 0.2 265 / 0.1)",
          }}
        >
          <Icon
            className="size-4"
            strokeWidth={1.5}
            style={{ color: "oklch(0.55 0.2 265)" }}
          />
        </div>
        <div>
          <h3
            className="text-[15px] font-semibold mb-1"
            style={{ color: "var(--mk-text)", letterSpacing: "-0.01em" }}
          >
            {title}
          </h3>
          <p
            className="text-[14px] leading-relaxed"
            style={{ color: "var(--mk-text-muted)" }}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Section ─────────────────────────────────────────────────────── */

export async function ApiSection() {
  const t = await getTranslations("apiSection")

  const features = [
    {
      icon: Code2,
      title: t("features.restApi.title"),
      description: t("features.restApi.description"),
    },
    {
      icon: Webhook,
      title: t("features.webhooks.title"),
      description: t("features.webhooks.description"),
    },
    {
      icon: BookOpen,
      title: t("features.docs.title"),
      description: t("features.docs.description"),
    },
  ]

  return (
    <section
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{ background: "var(--mk-bg)" }}
    >
      {/* Gradient mesh */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 50% 60% at 70% 40%, oklch(0.55 0.2 265 / 0.04) 0%, transparent 70%),
            radial-gradient(ellipse 40% 50% at 30% 60%, oklch(0.55 0.17 155 / 0.03) 0%, transparent 70%)
          `,
        }}
      />

      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <FadeIn>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 items-start">
            {/* Left — heading + feature items */}
            <div>
              <p
                className="text-[13px] font-medium uppercase tracking-widest mb-3"
                style={{ color: "var(--mk-brand-purple)" }}
              >
                {t("sectionLabel")}
              </p>
              <h2
                className="text-3xl sm:text-[2.75rem] font-bold leading-[1.1] mb-2"
                style={{ color: "var(--mk-text)", letterSpacing: "-0.035em" }}
              >
                {t("title")}
              </h2>
              <p
                className="text-[16px] leading-relaxed mb-4"
                style={{ color: "var(--mk-text-muted)" }}
              >
                {t("subtitle")}
              </p>

              <div>
                {features.map((feature, i) => (
                  <FeatureItem
                    key={feature.title}
                    icon={feature.icon}
                    title={feature.title}
                    description={feature.description}
                    isLast={i === features.length - 1}
                  />
                ))}
              </div>

              <div className="mt-6">
                <Link
                  href="/api/v1/docs"
                  className="inline-flex items-center gap-2 text-[14px] font-medium transition-colors hover:opacity-80"
                  style={{ color: "var(--mk-brand-purple)" }}
                >
                  {t("exploreDocsLink")}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>

            {/* Right — code preview */}
            <div className="lg:mt-8">
              <CodePreview t={(key: string) => t(key)} />
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
