import { Suspense } from "react"
import { connection } from "next/server"
import type { Metadata } from "next"
import { assertSuperAdmin } from "@/lib/dal"
import { AdminShell } from "@/components/admin/admin-shell"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

async function AdminLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()
  const session = await assertSuperAdmin()

  return (
    <AdminShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        restaurantId: session.user.restaurantId,
      }}
    >
      {children}
    </AdminShell>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  )
}
