import { Suspense } from "react"
import { connection } from "next/server"
import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { assertAdminRole } from "@/lib/dal"
import { AdminShell } from "@/components/admin/admin-shell"

const ADMIN_NAMESPACES = ["common", "admin"] as const

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

async function AdminLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()
  const session = await assertAdminRole("ADMIN_SUPPORT")

  const messages = await getMessages()
  const adminMessages: Record<string, unknown> = {}
  for (const ns of ADMIN_NAMESPACES) {
    if (ns in messages) adminMessages[ns] = messages[ns as keyof typeof messages]
  }

  return (
    <NextIntlClientProvider messages={adminMessages}>
      <AdminShell
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          organizationId: null,
          role: session.user.role,
        }}
      >
        {children}
      </AdminShell>
    </NextIntlClientProvider>
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
