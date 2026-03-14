"use client"

import { useState } from "react"
import {
  Link2,
  Copy,
  Check,
  MessageCircle,
  Mail,
  Share2,
  Code2,
  ChevronDown,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

type ShareLinkSectionProps = {
  joinUrl: string
  templateName: string
  organizationName: string
}

export function ShareLinkSection({
  joinUrl,
  templateName,
  organizationName,
}: ShareLinkSectionProps) {
  const t = useTranslations("dashboard.distribution")
  const [copied, setCopied] = useState(false)
  const [showEmbed, setShowEmbed] = useState(false)
  const [embedCopied, setEmbedCopied] = useState(false)

  const shareText = `Join ${templateName} by ${organizationName}`

  const embedCode = `<a href="${joinUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#111;color:#fff;border-radius:8px;font-family:system-ui,sans-serif;font-size:14px;font-weight:500;text-decoration:none">Join ${templateName}</a>`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = joinUrl
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyEmbed() {
    try {
      await navigator.clipboard.writeText(embedCode)
    } catch {
      /* ignore */
    }
    setEmbedCopied(true)
    toast.success(t("embedCopied"))
    setTimeout(() => setEmbedCopied(false), 2000)
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${joinUrl}`)}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function shareEmail() {
    const subject = encodeURIComponent(shareText)
    const body = encodeURIComponent(`${shareText}\n\n${joinUrl}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  async function shareNative() {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url: joinUrl })
      } catch {
        /* user cancelled */
      }
    } else {
      await copyLink()
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-brand/10">
          <Link2 className="size-3.5 text-brand" />
        </div>
        <h3 className="text-sm font-medium">{t("shareLink")}</h3>
      </div>

      {/* Prominent URL + copy */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
          <span className="text-[13px] text-muted-foreground truncate block">
            {joinUrl}
          </span>
        </div>
        <Button
          onClick={copyLink}
          variant={copied ? "default" : "outline"}
          size="sm"
          className="shrink-0 gap-1.5 h-[42px] px-4"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? t("copied") : t("copyLink")}
        </Button>
      </div>

      {/* Share channel buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-[13px]"
          onClick={shareWhatsApp}
        >
          <MessageCircle className="size-3.5" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-[13px]"
          onClick={shareEmail}
        >
          <Mail className="size-3.5" />
          Email
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-[13px]"
          onClick={shareNative}
        >
          <Share2 className="size-3.5" />
          Share...
        </Button>
      </div>

      {/* Embed code (collapsible) */}
      <div>
        <button
          type="button"
          onClick={() => setShowEmbed(!showEmbed)}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Code2 className="size-3.5" />
          Embed on your website
          <ChevronDown
            className={`size-3 transition-transform ${showEmbed ? "rotate-180" : ""}`}
          />
        </button>
        {showEmbed && (
          <div className="mt-2 space-y-2">
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <code className="text-[11px] text-muted-foreground break-all leading-relaxed">
                {embedCode}
              </code>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-[12px] h-7"
              onClick={copyEmbed}
            >
              {embedCopied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
              Copy embed code
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
