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
      <div className="relative p-5 overflow-x-auto">
        <pre className="text-[12px] sm:text-[13px] leading-[1.7] font-mono">
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
        {/* Scroll fade hint */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:hidden"
          style={{
            background: "linear-gradient(to right, transparent, oklch(0.13 0.005 285))",
          }}
        />
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
      className="relative py-32 overflow-hidden"
      style={{ background: "oklch(0.1 0.005 285)", color: "oklch(0.95 0 0)" }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <FadeIn>
          <div className="grid grid-cols-1 gap-24 lg:grid-cols-2 items-center">
            {/* Left — heading + feature items */}
            <div className="flex flex-col gap-8">
              <p
                className="text-[13px] font-black uppercase tracking-[0.2em]"
                style={{ color: "var(--mk-brand-green)" }}
              >
                {t("sectionLabel")}
              </p>
              <h2
                className="mk-clamp-h2 font-black tracking-tight leading-tight"
              >
                {t("title")}
              </h2>
              <p
                className="text-lg leading-relaxed"
                style={{ color: "oklch(0.6 0.01 285)" }}
              >
                {t("subtitle")}
              </p>

              <div className="flex flex-col gap-4">
                {features.map((feature) => {
                  const Icon = feature.icon
                  return (
                    <div key={feature.title} className="flex items-center gap-4">
                      <Icon className="size-5" style={{ color: "var(--mk-brand-green)" }} strokeWidth={1.5} />
                      <span className="text-sm font-bold">{feature.title}</span>
                    </div>
                  )
                })}
              </div>

              <div>
                <Link
                  href="/api/v1/docs"
                  className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: "var(--mk-brand-green)" }}
                >
                  {t("exploreDocsLink")}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>

            {/* Right — code preview with purple glow */}
            <div className="relative">
              {/* Purple glow behind code */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-20 rounded-full blur-[100px]"
                style={{ background: "oklch(0.55 0.2 265 / 0.2)" }}
              />
              <div className="relative">
                <CodePreview t={(key: string) => t(key)} />
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
