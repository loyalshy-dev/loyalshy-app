import "server-only"

import { getAccessToken } from "./credentials"
import {
  GOOGLE_WALLET_API_BASE,
  GOOGLE_WALLET_ISSUER_ID,
  buildTemplateClassId,
} from "./constants"

/**
 * Broadcasts an announcement to every Google Wallet holder of a template in
 * ONE call by PATCHing the template's loyalty CLASS with a TEXT_AND_NOTIFY
 * message. Google notifies all users holding an object of this class; the
 * deterministic id (announce-{sentAt ms}) means retries and later class
 * PATCHes from the issuance path never re-fire the banner.
 *
 * Best-effort: a 404 means no Google pass was ever saved for this template
 * (the class is created lazily on first save) — treated as success.
 */
export async function sendGoogleClassAnnouncement(args: {
  templateId: string
  organizationName: string
  message: string
  sentAt: Date
}): Promise<void> {
  if (!GOOGLE_WALLET_ISSUER_ID) return

  const classId = buildTemplateClassId(args.templateId)
  const token = await getAccessToken()

  const patchBody = {
    // Must include reviewStatus when updating an approved class
    reviewStatus: "UNDER_REVIEW",
    messages: [
      {
        id: `announce-${args.sentAt.getTime()}`,
        header: args.organizationName,
        body: args.message,
        messageType: "TEXT_AND_NOTIFY",
      },
    ],
  }

  const response = await fetch(
    `${GOOGLE_WALLET_API_BASE}/loyaltyClass/${encodeURIComponent(classId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patchBody),
    }
  )

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text().catch(() => "")
    console.error(
      `Google class announcement PATCH failed (${response.status}) templateId=${args.templateId}:`,
      errorText.slice(0, 200)
    )
  }
}
