"use client"

import { useState } from "react"
import { Check, Copy, Nfc } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

type Props = {
  joinUrl: string
}

export function NfcSection({ joinUrl }: Props) {
  const t = useTranslations("dashboard.distribution")
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Nfc className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t("nfcTitle")}</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("nfcDescription")}
      </p>
      <div className="rounded-md bg-muted/50 p-3 flex items-center gap-2">
        <code className="text-xs font-mono flex-1 truncate">{joinUrl}</code>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          aria-label={t("nfcCopyUrl")}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
        <li>{t("nfcStep1")}</li>
        <li>{t("nfcStep2")}</li>
        <li>{t("nfcStep3")}</li>
      </ol>
    </div>
  )
}
