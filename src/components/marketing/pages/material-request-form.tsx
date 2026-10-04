"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { track } from "@vercel/analytics"
import { toast } from "sonner"
import { Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { submitMaterialRequest, type MaterialRequestInput } from "@/server/material-request-actions"
import { MATERIAL_PIECES as PIECES, MATERIAL_QUANTITIES as QUANTITIES, type MaterialPiece as Piece, type MaterialQuantity } from "@/lib/material-request"

// The quote request on /promote. Same shape as the contact form (honeypot,
// 3/h per IP, email to the team + confirmation), plus the pieces and a
// quantity so the answer can carry a price. Labels come from the server
// (`pages.promote.form`): the marketing shell ships only `common` + `nav`
// to the browser.

export type MaterialFormLabels = {
  name: string
  namePlaceholder: string
  email: string
  emailPlaceholder: string
  business: string
  businessPlaceholder: string
  pieces: string
  pieceOptions: Record<Piece, string>
  quantity: string
  quantityOptions: Record<MaterialQuantity, string>
  message: string
  messagePlaceholder: string
  submit: string
  note: string
  successTitle: string
  successBody: string
  piecesRequired: string
}

export function MaterialRequestForm({ labels: L }: { labels: MaterialFormLabels }) {
  const tCommon = useTranslations("common")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [business, setBusiness] = useState("")
  const [pieces, setPieces] = useState<Piece[]>([])
  const [quantity, setQuantity] = useState<MaterialQuantity>("1")
  const [message, setMessage] = useState("")

  const toggle = (p: Piece, on: boolean) => setPieces((prev) => (on ? [...new Set([...prev, p])] : prev.filter((x) => x !== p)))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pieces.length === 0) {
      toast.error(L.piecesRequired)
      return
    }
    setLoading(true)
    const input: MaterialRequestInput = {
      name,
      email,
      business,
      pieces,
      quantity,
      message,
      website: (document.getElementById("material-website") as HTMLInputElement | null)?.value || "",
    }
    try {
      const result = await submitMaterialRequest(input)
      if (result.error) {
        toast.error(result.error)
        return
      }
      track("material_request", { pieces: pieces.join(","), quantity })
      setDone(true)
    } catch {
      // The action itself threw (network, a stale action manifest after a deploy)
      toast.error(tCommon("error"))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <CheckCircle2 className="size-7" style={{ color: "var(--mk-accent)" }} />
        <h3 className="font-display mt-5 text-2xl font-bold" style={{ color: "var(--mk-text)" }}>{L.successTitle}</h3>
        <p className="mk-body mt-3 max-w-[44ch]" style={{ color: "var(--mk-text-muted)" }}>{L.successBody}</p>
      </div>
    )
  }

  const field = (id: string, label: string, control: React.ReactNode) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[13px] font-medium" style={{ color: "var(--mk-text)" }}>
        {label}
      </Label>
      {control}
    </div>
  )

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        {field("m-name", L.name, <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={L.namePlaceholder} required maxLength={100} className="mk-input" />)}
        {field("m-email", L.email, <Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={L.emailPlaceholder} required maxLength={255} className="mk-input" />)}
      </div>
      {field("m-business", L.business, <Input id="m-business" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder={L.businessPlaceholder} required maxLength={100} className="mk-input" />)}

      <fieldset className="space-y-3">
        <legend className="text-[13px] font-medium" style={{ color: "var(--mk-text)" }}>{L.pieces}</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {PIECES.map((p) => (
            <label key={p} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 mk-body-sm" style={{ border: "1px solid var(--mk-border)", color: "var(--mk-text)" }}>
              <Checkbox checked={pieces.includes(p)} onCheckedChange={(v) => toggle(p, v === true)} aria-label={L.pieceOptions[p]} />
              {L.pieceOptions[p]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        {field(
          "m-quantity",
          L.quantity,
          <Select value={quantity} onValueChange={(v) => setQuantity(v as MaterialQuantity)}>
            <SelectTrigger id="m-quantity" className="mk-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUANTITIES.map((q) => (
                <SelectItem key={q} value={q} className="text-[14px]">
                  {L.quantityOptions[q]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>,
        )}
      </div>

      {field("m-message", L.message, <Textarea id="m-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={L.messagePlaceholder} maxLength={2000} rows={4} className="mk-input resize-none leading-relaxed" />)}

      <div className="absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden="true">
        <label htmlFor="material-website">Website</label>
        <input type="text" id="material-website" name="website" tabIndex={-1} autoComplete="nope" aria-hidden="true" />
      </div>

      <Button type="submit" disabled={loading} className="mk-btn-primary h-12 w-full gap-2 rounded-full text-[15px]! font-medium">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {tCommon("loading")}
          </>
        ) : (
          L.submit
        )}
      </Button>
      <p className="text-center text-[12px] leading-relaxed" style={{ color: "var(--mk-text-dimmed)" }}>{L.note}</p>
    </form>
  )
}
