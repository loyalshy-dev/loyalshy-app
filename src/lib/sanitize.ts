/**
 * Sanitize user-provided text for database storage.
 * NOT an HTML sanitizer (React handles XSS for rendering).
 * Prevents database pollution from control chars, excess whitespace.
 */
export function sanitizeText(
  input: string,
  maxLength: number = 500
): string {
  return (
    input
      // Strip control characters (U+0000–U+001F) except newline (U+000A) and tab (U+0009)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
      // Collapse multiple spaces into one
      .replace(/ {2,}/g, " ")
      // Trim leading/trailing whitespace
      .trim()
      // Enforce max length
      .slice(0, maxLength)
  )
}
