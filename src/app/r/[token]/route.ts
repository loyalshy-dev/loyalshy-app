import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { isAllowedReviewUrl } from "@/lib/reviews/config"
import { verifyReviewToken } from "@/lib/reviews/token"

type Params = Promise<{ token: string }>

/**
 * GET /r/{token} — the "leave a review" link on wallet passes. Counts the
 * tap on the contact, then 302s to the org's Google review URL. A token
 * that doesn't verify (or an org that turned the feature off) lands on the
 * home page; nothing is recorded.
 */
export async function GET(request: Request, { params }: { params: Params }) {
  const { token } = await params
  const fallback = new URL("/", request.url)

  const passInstanceId = verifyReviewToken(token)
  if (!passInstanceId) return NextResponse.redirect(fallback, 302)

  const pass = await db.passInstance.findUnique({
    where: { id: passInstanceId },
    select: {
      contactId: true,
      passTemplate: {
        select: { organization: { select: { reviewSettings: { select: { reviewUrl: true } } } } },
      },
    },
  })
  const reviewUrl = pass?.passTemplate.organization.reviewSettings?.reviewUrl
  if (!pass || !reviewUrl || !isAllowedReviewUrl(reviewUrl)) {
    return NextResponse.redirect(fallback, 302)
  }

  try {
    const now = new Date()
    await db.contact.update({
      where: { id: pass.contactId },
      data: { reviewLinkOpens: { increment: 1 } },
    })
    await db.contact.updateMany({
      where: { id: pass.contactId, reviewLinkOpenedAt: null },
      data: { reviewLinkOpenedAt: now },
    })
  } catch (err) {
    // Tracking is best-effort; the customer still gets to Google.
    console.error("[review-link] tracking failed:", err instanceof Error ? err.message : err)
  }

  return NextResponse.redirect(reviewUrl, 302)
}
