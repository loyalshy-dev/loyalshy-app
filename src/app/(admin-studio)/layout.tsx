import { Suspense } from "react"
import { connection } from "next/server"
import type { Metadata } from "next"
import { assertSuperAdmin } from "@/lib/dal"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

async function AdminStudioLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()
  await assertSuperAdmin()
  return <>{children}</>
}

export default function AdminStudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense>
      <AdminStudioLayoutInner>{children}</AdminStudioLayoutInner>
    </Suspense>
  )
}
