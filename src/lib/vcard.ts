// ─── vCard (RFC 6350) Generator ──────────────────────────────
// Generates a .vcf file from business card config + organization name.
// No dependencies — vCard 4.0 format is simple text.

import type { BusinessCardConfig } from "@/types/pass-types"

type VCardInput = {
  config: BusinessCardConfig
  organizationName: string
}

/** Escape special characters per RFC 6350 (semicolons, commas, backslashes, newlines) */
function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

/** Generate RFC 6350 vCard 4.0 content */
export function generateVCard({ config, organizationName }: VCardInput): string {
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:4.0",
    `FN:${escapeVCard(config.contactName)}`,
  ]

  if (config.jobTitle) {
    lines.push(`TITLE:${escapeVCard(config.jobTitle)}`)
  }

  lines.push(`ORG:${escapeVCard(organizationName)}`)

  if (config.phone) {
    lines.push(`TEL;TYPE=work;VALUE=uri:tel:${config.phone.replace(/\s/g, "")}`)
  }

  if (config.email) {
    lines.push(`EMAIL;TYPE=work:${config.email}`)
  }

  if (config.website) {
    lines.push(`URL:${config.website}`)
  }

  if (config.linkedinUrl) {
    lines.push(`URL;TYPE=linkedin:${config.linkedinUrl}`)
  }

  if (config.twitterUrl) {
    lines.push(`URL;TYPE=x:${config.twitterUrl}`)
  }

  if (config.instagramUrl) {
    lines.push(`URL;TYPE=instagram:${config.instagramUrl}`)
  }

  lines.push("END:VCARD")

  return lines.join("\r\n") + "\r\n"
}
