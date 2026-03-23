"use client"

import { useState } from "react"
import { Check, Copy, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

type Props = {
  joinUrl: string
  organizationName: string
  templateName: string
}

export function EmbedSnippetSection({ joinUrl, organizationName, templateName }: Props) {
  const t = useTranslations("dashboard.distribution")
  const [copied, setCopied] = useState(false)

  const snippet = `<!-- ${organizationName} - ${templateName} -->
<a href="${joinUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#1a1a2e;color:#fff;border-radius:8px;text-decoration:none;font-family:system-ui,sans-serif;font-size:14px;font-weight:500;">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ${t("embedButtonText")}
</a>`

  function handleCopy() {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Code2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t("embedSnippet")}</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("embedDescription")}
      </p>
      <div className="relative">
        <pre className="rounded-md bg-muted/50 p-3 text-xs font-mono overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
          {snippet}
        </pre>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2"
          onClick={handleCopy}
          aria-label={t("copySnippet")}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}
