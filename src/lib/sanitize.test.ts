import { describe, it, expect } from "vitest"
import { sanitizeText } from "./sanitize"

describe("sanitizeText", () => {
  it("trims leading and trailing whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello")
  })

  it("collapses multiple spaces into one", () => {
    expect(sanitizeText("hello   world")).toBe("hello world")
  })

  it("strips control characters (except newline and tab)", () => {
    expect(sanitizeText("hello\x00world")).toBe("helloworld")
    expect(sanitizeText("hello\x01\x02\x03world")).toBe("helloworld")
    expect(sanitizeText("hello\x0Eworld")).toBe("helloworld")
  })

  it("preserves newlines", () => {
    expect(sanitizeText("hello\nworld")).toBe("hello\nworld")
  })

  it("preserves tabs", () => {
    expect(sanitizeText("hello\tworld")).toBe("hello\tworld")
  })

  it("enforces default max length (500)", () => {
    const long = "a".repeat(600)
    expect(sanitizeText(long)).toHaveLength(500)
  })

  it("enforces custom max length", () => {
    const long = "a".repeat(100)
    expect(sanitizeText(long, 50)).toHaveLength(50)
  })

  it("handles empty string", () => {
    expect(sanitizeText("")).toBe("")
  })

  it("handles whitespace-only string", () => {
    expect(sanitizeText("   ")).toBe("")
  })

  it("handles string at exact max length", () => {
    const exact = "a".repeat(500)
    expect(sanitizeText(exact)).toHaveLength(500)
    expect(sanitizeText(exact)).toBe(exact)
  })

  it("combines all operations: strip, collapse, trim, truncate", () => {
    const input = "  hello\x00   world  "
    expect(sanitizeText(input, 10)).toBe("hello worl")
  })
})
