"use server"

import crypto from "crypto"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { assertAuthenticated } from "@/lib/dal"

// ─── Partner referral links ─────────────────────────────────
//
// A partner shares /register?ref={code}; when the client finishes signup
// and creates their org, createOrganization resolves the code and stamps
// Organization.referredById. Codes are lazily generated the first time a
// partner asks for their link.

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
}

/**
 * Returns the current partner's referral link, generating and persisting
 * their referral code on first use.
 */
export async function getMyReferralLink(): Promise<
  { url: string; code: string } | { error: "not_a_partner" | "code_generation_failed" }
> {
  const session = await assertAuthenticated()

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isPartner: true, referralCode: true, name: true },
  })
  if (!user?.isPartner) {
    return { error: "not_a_partner" }
  }

  const siteUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"

  if (user.referralCode) {
    return { url: `${siteUrl}/register?ref=${user.referralCode}`, code: user.referralCode }
  }

  // Lazily generate: readable name slug + short random suffix; retry on
  // the (unlikely) unique collision.
  const base = slugifyName(user.name) || "partner"
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = `${base}-${crypto.randomBytes(3).toString("hex")}`
    try {
      await db.user.update({
        where: { id: session.user.id },
        data: { referralCode: code },
      })
      return { url: `${siteUrl}/register?ref=${code}`, code }
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        continue
      }
      throw err
    }
  }
  return { error: "code_generation_failed" }
}
