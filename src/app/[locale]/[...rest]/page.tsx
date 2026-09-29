import { notFound } from "next/navigation"

// Unknown paths under a locale (/es/whatever) render [locale]/not-found.tsx.
export default function CatchAllPage() {
  notFound()
}
