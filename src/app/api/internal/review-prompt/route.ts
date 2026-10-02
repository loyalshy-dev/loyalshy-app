import { NextResponse } from "next/server"
import { z } from "zod"
import { isAuthorizedInternalRequest } from "@/lib/internal-auth"
import { sendReviewPrompt } from "@/lib/reviews/send"

const bodySchema = z.object({
  contactId: z.string().min(1).max(64),
  passInstanceId: z.string().min(1).max(64),
})

/**
 * POST /api/internal/review-prompt — called by the delayed Trigger.dev run
 * `send-review-prompt` (src/trigger/send-review-prompt.ts). The webapp owns
 * delivery so it can use the real wallet helpers. Skips answer 200 with a
 * reason (no retry); a failed push answers 500 so Trigger.dev retries.
 */
export async function POST(request: Request) {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }
  try {
    const result = await sendReviewPrompt(parsed.data)
    return NextResponse.json(result)
  } catch (err) {
    console.error(
      "[review-prompt] send failed:",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: "Send failed" }, { status: 500 })
  }
}
