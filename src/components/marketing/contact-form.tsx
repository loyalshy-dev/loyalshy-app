"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react"
import { submitContactForm } from "@/server/contact-form-actions"
import type { ContactFormInput } from "@/server/contact-form-actions"

const INQUIRY_TYPES = ["general", "sales", "partnership", "support"] as const

export function ContactForm() {
  const t = useTranslations("contact")
  const tCommon = useTranslations("common")
  const searchParams = useSearchParams()

  // Pre-select inquiry type from URL (e.g., /contact?type=sales)
  const typeParam = searchParams.get("type")
  const initialType = INQUIRY_TYPES.includes(typeParam as typeof INQUIRY_TYPES[number])
    ? typeParam!
    : "general"

  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [inquiryType, setInquiryType] = useState<string>(initialType)
  const [company, setCompany] = useState("")
  const [message, setMessage] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const input: ContactFormInput = {
      name,
      email,
      inquiryType: inquiryType as ContactFormInput["inquiryType"],
      company,
      message,
      website: (document.getElementById("website") as HTMLInputElement)?.value || "",
    }

    const result = await submitContactForm(input)

    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    setIsSubmitted(true)
    setIsLoading(false)
  }

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div
          className="mb-6 flex size-14 items-center justify-center rounded-2xl"
          style={{
            background: "oklch(0.704 0.193 32 / 0.08)",
            border: "1px solid oklch(0.704 0.193 32 / 0.12)",
          }}
        >
          <CheckCircle2
            className="size-7"
            style={{ color: "oklch(0.704 0.193 32)" }}
          />
        </div>
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--mk-text)", letterSpacing: "-0.03em" }}
        >
          {t("successTitle")}
        </h2>
        <p
          className="mt-3 max-w-sm text-[15px] leading-relaxed"
          style={{ color: "var(--mk-text-muted)" }}
        >
          {t("successMessage")}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name + Email */}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label={t("nameLabel")}
          required
        >
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            required
            maxLength={100}
            className="mk-input"
            aria-required="true"
          />
        </FormField>

        <FormField
          label={t("emailLabel")}
          required
        >
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            required
            maxLength={255}
            className="mk-input"
            aria-required="true"
          />
        </FormField>
      </div>

      {/* Inquiry type + Company */}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label={t("inquiryTypeLabel")}
          required
        >
          <Select value={inquiryType} onValueChange={setInquiryType}>
            <SelectTrigger className="mk-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INQUIRY_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="text-[14px]">
                  {t(`inquiryTypes.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label={t("companyLabel")}>
          <Input
            id="company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={t("companyPlaceholder")}
            maxLength={100}
            className="mk-input"
          />
        </FormField>
      </div>

      {/* Message */}
      <FormField
        label={t("messageLabel")}
        required
        hint={t("messageHint")}
      >
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("messagePlaceholder")}
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          className="mk-input resize-none leading-relaxed"
          aria-required="true"
        />
      </FormField>

      {/* Honeypot */}
      <div
        className="overflow-hidden opacity-0 h-0 w-0 absolute"
        aria-hidden="true"
      >
        <label htmlFor="website">Website</label>
        <input
          type="text"
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="nope"
          aria-hidden="true"
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isLoading}
        className="mk-btn-primary w-full h-12 rounded-full text-[15px]! font-medium gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {tCommon("loading")}
          </>
        ) : (
          <>
            {t("submitButton")}
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>

      <p
        className="text-center text-[12px] leading-relaxed"
        style={{ color: "var(--mk-text-dimmed)" }}
      >
        {t("privacyNote")}
      </p>
    </form>
  )
}

/* ─── Reusable field wrapper ──────────────────────────────────────── */

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label
        className="text-[13px] font-medium"
        style={{ color: "var(--mk-text)" }}
      >
        {label}
        {required && (
          <span className="ml-0.5" style={{ color: "oklch(0.704 0.193 32)" }}>
            *
          </span>
        )}
      </Label>
      {children}
      {hint && (
        <p className="text-[12px]" style={{ color: "var(--mk-text-dimmed)" }}>
          {hint}
        </p>
      )}
    </div>
  )
}
