"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Printer, FileText, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/i18n/config"
import { localePath } from "@/i18n/marketing"
import { renderCounterCard, renderTableTent, type FaceSpec } from "./counter-material"

// Distribution → "Counter material": the A6 counter card and the A4 table
// tent as print-ready PDFs, with the program's QR, the business name and
// its colors. The tent's second face asks for a Google review when the
// org has a review link; otherwise it repeats the program face.

type Props = {
  organization: { name: string; slug: string; brandColor: string | null }
  template: { id: string; name: string; rewardLine: string; accentColor: string; qrLogoUrl: string | null }
  joinUrl: string
  reviewUrl: string | null
}

export function CounterMaterialSection({ organization, template, joinUrl, reviewUrl }: Props) {
  const t = useTranslations("dashboard.distribution")
  const locale = useLocale() as Locale
  const [busy, setBusy] = useState<"card" | "tent" | null>(null)

  const base: Omit<FaceSpec, "title" | "line" | "qrValue"> = {
    accent: template.accentColor,
    businessName: organization.name,
    footer: "loyalshy.com",
    qrLogoText: organization.name.charAt(0).toUpperCase(),
    qrLogoUrl: template.qrLogoUrl,
  }
  const programFace: FaceSpec = { ...base, title: template.rewardLine || template.name, line: t("materialScanLine"), qrValue: joinUrl }
  const reviewsFace: FaceSpec | null = reviewUrl ? { ...base, title: organization.name, line: t("materialReviewsLine"), qrValue: reviewUrl } : null

  const fileBase = `${organization.slug}-${template.name.toLowerCase().replace(/\s+/g, "-")}`

  async function downloadCard() {
    setBusy("card")
    try {
      const { jsPDF } = await import("jspdf")
      const png = await renderCounterCard(programFace)
      const pdf = new jsPDF({ unit: "mm", format: [105, 148], orientation: "portrait" })
      pdf.addImage(png, "JPEG", 0, 0, 105, 148)
      pdf.save(`${fileBase}-counter-card.pdf`)
    } catch {
      toast.error(t("materialFailed"))
    } finally {
      setBusy(null)
    }
  }

  async function downloadTent() {
    setBusy("tent")
    try {
      const { jsPDF } = await import("jspdf")
      const { dataUrl } = await renderTableTent(programFace, reviewsFace ?? programFace, t("materialFold"))
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
      pdf.addImage(dataUrl, "JPEG", 0, 0, 210, 297)
      pdf.save(`${fileBase}-table-tent.pdf`)
    } catch {
      toast.error(t("materialFailed"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-brand/10">
          <Printer className="size-3.5 text-brand" />
        </div>
        <h3 className="text-sm font-medium">{t("materialTitle")}</h3>
      </div>
      <p className="text-[13px] text-muted-foreground">{t("materialDescription")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={downloadCard} disabled={busy !== null} variant="outline" className="w-full gap-2">
          <FileText className="size-4" />
          {busy === "card" ? t("generating") : t("materialCounterCard")}
        </Button>
        <Button onClick={downloadTent} disabled={busy !== null} variant="outline" className="w-full gap-2">
          <FileText className="size-4" />
          {busy === "tent" ? t("generating") : t("materialTableTent")}
        </Button>
      </div>
      <p className="text-[12px] text-muted-foreground">{reviewsFace ? t("materialTentReviews") : t("materialTentNoReviews")}</p>
      <a
        href={localePath(locale, "/promote")}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium underline underline-offset-4"
      >
        {t("materialIdeas")}
        <ExternalLink className="size-3.5" />
      </a>
    </Card>
  )
}
