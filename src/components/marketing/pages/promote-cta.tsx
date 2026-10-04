"use client"

import Link from "next/link"
import { track } from "@vercel/analytics"

// The two actions under each block on /promote: "ask us to make it" (to
// the request form, counted per piece so we learn which ones people want)
// and "free from your dashboard" (to the app).

export function OrderCta({ piece, label }: { piece: string; label: string }) {
  return (
    <a
      href="#request"
      className="mk-btn-ghost"
      onClick={() => track("material_cta", { piece })}
    >
      {label}
    </a>
  )
}

export function FreeCta({ piece, label }: { piece: string; label: string }) {
  return (
    <Link
      href="/register"
      className="mk-body-sm font-medium underline underline-offset-4"
      style={{ color: "var(--mk-text)" }}
      onClick={() => track("material_free", { piece })}
    >
      {label}
    </Link>
  )
}
