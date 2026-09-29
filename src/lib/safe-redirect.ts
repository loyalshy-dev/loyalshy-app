const BASE = "http://same-origin.invalid"

/**
 * Returns `value` only if it is a path on this site ("/dashboard?x=1#y"),
 * otherwise `fallback`. Use for any redirect target taken from the URL
 * (e.g. /login?callbackUrl=) so it can't send users to another site after
 * they sign in. Rejects absolute URLs, protocol-relative "//host",
 * backslash tricks ("/\host" — browsers treat "\" as "/"), and
 * javascript:/data: URLs.
 */
export function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback
  if (/[\\\u0000-\u001f]/.test(value)) return fallback
  try {
    const url = new URL(value, BASE)
    if (url.origin !== BASE) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
