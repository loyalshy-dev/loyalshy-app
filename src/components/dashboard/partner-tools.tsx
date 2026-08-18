"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Link2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { createClientOrg, createHandoffLink } from "@/server/handoff-actions"
import { getMyReferralLink } from "@/server/referral-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ─── New client setup (partner reps only) ───────────────────

type NewClientDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewClientDialog({ open, onOpenChange }: NewClientDialogProps) {
  const t = useTranslations("dashboard.partner")
  const [name, setName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || isCreating) return
    setIsCreating(true)

    const result = await createClientOrg({ name })
    if ("error" in result) {
      toast.error(t("createError"))
      setIsCreating(false)
      return
    }
    // Hard navigation: the whole dashboard must re-render against the new
    // active org (same rationale as the org switcher).
    window.location.assign("/dashboard")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newClientTitle")}</DialogTitle>
          <DialogDescription>{t("newClientDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">{t("nameLabel")}</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              maxLength={100}
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating && <Loader2 className="size-3.5 animate-spin" />}
              {t("createButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Handoff link (transfer ownership to the client) ────────

type HandoffDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  organizationName: string
}

export function HandoffDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
}: HandoffDialogProps) {
  const t = useTranslations("dashboard.partner")
  const [url, setUrl] = useState<string | null>(null)
  const [ownerEmail, setOwnerEmail] = useState("")
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    if (isGenerating) return
    setIsGenerating(true)

    const email = ownerEmail.trim()
    const result = await createHandoffLink(organizationId, email || undefined)
    if ("error" in result) {
      toast.error(result.error === "invalid_email" ? t("invalidEmail") : t("handoffError"))
    } else {
      setUrl(result.url)
      setCopied(false)
      if (email && result.emailSent) {
        setSentTo(email)
        toast.success(t("handoffSent", { email }))
      } else if (email && !result.emailSent) {
        setSentTo(null)
        toast.error(t("handoffSendFailed"))
      }
    }
    setIsGenerating(false)
  }

  async function handleCopy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t("copied"))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("copyFailed"))
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setUrl(null)
      setOwnerEmail("")
      setSentTo(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("handoffTitle", { organizationName })}</DialogTitle>
          <DialogDescription>{t("handoffDesc")}</DialogDescription>
        </DialogHeader>

        {url ? (
          <div className="space-y-3">
            {sentTo && (
              <p className="text-sm text-success">{t("handoffSent", { email: sentTo })}</p>
            )}
            <div className="flex items-center gap-2">
              <Input value={url} readOnly className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label={t("copyLink")}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("handoffExpiry")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="handoff-email">{t("ownerEmailLabel")}</Label>
              <Input
                id="handoff-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder={t("ownerEmailPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("ownerEmailHint")}</p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isGenerating}
              >
                {t("cancel")}
              </Button>
              <Button type="button" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Link2 className="size-3.5" />
                )}
                {ownerEmail.trim() ? t("generateAndSend") : t("generateLink")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Referral link (attributed self-signup) ─────────────────

type ReferralLinkDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReferralLinkDialog({ open, onOpenChange }: ReferralLinkDialogProps) {
  const t = useTranslations("dashboard.partner")
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // The link is stable (the code is generated once and reused), so fetch
  // it automatically whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    getMyReferralLink().then((result) => {
      if (cancelled) return
      if ("error" in result) {
        toast.error(t("referralError"))
        onOpenChange(false)
      } else {
        setUrl(result.url)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, t, onOpenChange])

  async function handleCopy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t("copied"))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("copyFailed"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("referralTitle")}</DialogTitle>
          <DialogDescription>{t("referralDesc")}</DialogDescription>
        </DialogHeader>
        {url ? (
          <div className="flex items-center gap-2">
            <Input value={url} readOnly className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopy}
              aria-label={t("copyLink")}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
