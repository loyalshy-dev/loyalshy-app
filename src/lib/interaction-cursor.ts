/**
 * Keyset cursor for the interactions feed: the (createdAt, id) of the last
 * row served, so the next page is "everything strictly older than this"
 * and a stamp arriving mid-scroll can't shift the pages the way an offset
 * does. Opaque to clients (base64url of "iso|id").
 */

export type InteractionCursor = { createdAt: Date; id: string }

export function encodeInteractionCursor(c: InteractionCursor): string {
  return Buffer.from(`${c.createdAt.toISOString()}|${c.id}`, "utf8").toString("base64url")
}

export function decodeInteractionCursor(raw: string | null | undefined): InteractionCursor | null {
  if (!raw) return null
  let text: string
  try {
    text = Buffer.from(raw, "base64url").toString("utf8")
  } catch {
    return null
  }
  const sep = text.indexOf("|")
  if (sep <= 0 || sep === text.length - 1) return null
  const createdAt = new Date(text.slice(0, sep))
  const id = text.slice(sep + 1)
  if (Number.isNaN(createdAt.getTime()) || !/^[A-Za-z0-9_-]+$/.test(id)) return null
  return { createdAt, id }
}

/** Prisma `where` fragment: rows strictly after the cursor in (createdAt desc, id desc) order. */
export function afterInteractionCursor(c: InteractionCursor) {
  return {
    OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }],
  }
}
