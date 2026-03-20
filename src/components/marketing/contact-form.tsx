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
import { Loader2, CheckCircle2 } from "lucide-react"
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
          className="mb-6 flex size-16 items-center justify-center rounded-full"
          style={{ background: "oklch(0.58 0.16 145 / 0.1)" }}
        >
          <CheckCircle2
            className="size-8"
            style={{ color: "oklch(0.58 0.16 145)" }}
          />
        </div>
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--mk-text)", letterSpacing: "-0.03em" }}
        >
          {t("successTitle")}
        </h2>
        <p
          className="mt-3 max-w-md text-[15px] leading-relaxed"
          style={{ color: "var(--mk-text-muted)" }}
        >
          {t("successMessage")}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name + Email row */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="name"
            className="text-[13px] font-medium"
            style={{ color: "var(--mk-text)" }}
          >
            {t("nameLabel")} <span style={{ color: "oklch(0.65 0.2 25)" }}>*</span>
          </Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            required
            maxLength={100}
            className="h-11 rounded-lg border text-[14px]"
            style={{
              background: "var(--mk-surface, var(--mk-bg))",
              borderColor: "var(--mk-border)",
              color: "var(--mk-text)",
            }}
            aria-required="true"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-[13px] font-medium"
            style={{ color: "var(--mk-text)" }}
          >
            {t("emailLabel")} <span style={{ color: "oklch(0.65 0.2 25)" }}>*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            required
            maxLength={255}
            className="h-11 rounded-lg border text-[14px]"
            style={{
              background: "var(--mk-surface, var(--mk-bg))",
              borderColor: "var(--mk-border)",
              color: "var(--mk-text)",
            }}
            aria-required="true"
          />
        </div>
      </div>

      {/* Inquiry type + Company row */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="inquiryType"
            className="text-[13px] font-medium"
            style={{ color: "var(--mk-text)" }}
          >
            {t("inquiryTypeLabel")} <span style={{ color: "oklch(0.65 0.2 25)" }}>*</span>
          </Label>
          <Select value={inquiryType} onValueChange={setInquiryType}>
            <SelectTrigger
              id="inquiryType"
              className="h-11 rounded-lg border text-[14px]"
              style={{
                background: "var(--mk-surface, var(--mk-bg))",
                borderColor: "var(--mk-border)",
                color: "var(--mk-text)",
              }}
            >
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
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="company"
            className="text-[13px] font-medium"
            style={{ color: "var(--mk-text)" }}
          >
            {t("companyLabel")}
          </Label>
          <Input
            id="company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={t("companyPlaceholder")}
            maxLength={100}
            className="h-11 rounded-lg border text-[14px]"
            style={{
              background: "var(--mk-surface, var(--mk-bg))",
              borderColor: "var(--mk-border)",
              color: "var(--mk-text)",
            }}
          />
        </div>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label
          htmlFor="message"
          className="text-[13px] font-medium"
          style={{ color: "var(--mk-text)" }}
        >
          {t("messageLabel")} <span style={{ color: "oklch(0.65 0.2 25)" }}>*</span>
        </Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("messagePlaceholder")}
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          className="rounded-lg border text-[14px] leading-relaxed resize-none"
          style={{
            background: "var(--mk-surface, var(--mk-bg))",
            borderColor: "var(--mk-border)",
            color: "var(--mk-text)",
          }}
          aria-required="true"
        />
        <p
          className="text-[12px]"
          style={{ color: "var(--mk-text-dimmed)" }}
        >
          {t("messageHint")}
        </p>
      </div>

      {/* Honeypot — invisible to real users, bots may fill it */}
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
        className="mk-btn-primary h-12 w-full rounded-full text-[15px]! font-medium"
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {tCommon("loading")}
          </>
        ) : (
          t("submitButton")
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
