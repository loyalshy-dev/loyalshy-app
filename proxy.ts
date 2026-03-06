import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// ─── proxy.ts ───────────────────────────────────────────────
// Next.js 16 replaces middleware.ts with proxy.ts.
// This is a UX OPTIMIZATION ONLY — not a security boundary.
// The DAL (src/lib/dal.ts) is the real security boundary.
//
// Rules:
// - Only read cookies. NO database calls.
// - NO role checks. NO heavy logic.
// - Just redirect unauthenticated users to /login
//   and authenticated users away from auth pages.
// ─────────────────────────────────────────────────────────────

const AUTH_PAGES_REDIRECT = ["/login", "/forgot-password"]
const PROTECTED_PREFIXES = ["/dashboard", "/admin"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = getSessionCookie(request)

  // Unauthenticated user trying to access protected routes
  if (!sessionCookie && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user on login/forgot-password → redirect to dashboard
  // NOTE: /register is NOT redirected here because the user may need to
  // complete the multi-step onboarding (create organization, etc.).
  // The register page itself handles the redirect if onboarding is complete.
  if (sessionCookie && AUTH_PAGES_REDIRECT.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Pass pathname to Server Components via request header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password",
  ],
}
