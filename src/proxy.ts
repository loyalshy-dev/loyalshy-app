import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// ─── proxy.ts ───────────────────────────────────────────────
// Next.js 16 replaces middleware.ts with proxy.ts. It must live in src/
// (next to app/) — at the project root it was silently ignored until
// 2026-09-29.
// This is a UX OPTIMIZATION ONLY — not a security boundary.
// The DAL (src/lib/dal.ts) is the real security boundary.
//
// Rules:
// - Only read cookies. NO database calls.
// - NO role checks. NO heavy logic.
// - Just send visitors without a session cookie to /login before the
//   protected page starts rendering.
//
// Deliberately NOT here: redirecting signed-in users away from auth pages.
// Cookie presence isn't a valid session (a removed member's sessions are
// deleted but the cookie stays), so /login → /dashboard → DAL → /login
// would loop. AuthRedirectGate does that redirect with real session facts.
// ─────────────────────────────────────────────────────────────

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
}
