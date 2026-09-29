import { Suspense } from "react"
import { connection } from "next/server"
import { assertAdminRole } from "@/lib/dal"
import { getPartners } from "@/server/partner-statement-actions"
import { PartnerStatementsView } from "@/components/admin/partners/partner-statements-view"

async function PartnersContent() {
  await connection()
  await assertAdminRole("ADMIN_BILLING")

  const partners = await getPartners()

  return (
    <PartnerStatementsView partners={Array.isArray(partners) ? partners : []} />
  )
}

export default function AdminPartnersPage() {
  return (
    <Suspense>
      <PartnersContent />
    </Suspense>
  )
}
