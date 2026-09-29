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
    <Suspense
      fallback={
        <div className="flex h-svh">
          <div className="hidden md:flex w-[240px] flex-col border-r bg-sidebar">
            <div className="p-4 space-y-4">
              <div className="h-8 w-32 rounded-md bg-muted animate-pulse" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 rounded-md bg-muted/50 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="h-14 border-b" />
            <div className="flex-1 p-6">
              <div className="h-8 w-64 rounded bg-muted animate-pulse mb-6" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      }
    >
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  )
}
