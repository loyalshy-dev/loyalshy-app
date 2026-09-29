import { Suspense } from "react"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { db } from "@/lib/db"
import { assertAuthenticated } from "@/lib/dal"
import { getMyPartnerClients } from "@/server/partner-console-actions"
import { getMyReferralLink } from "@/server/referral-actions"
import { PartnerConsoleView } from "@/components/dashboard/partner/partner-console-view"

async function PartnerConsoleContent() {
  await connection()
  const session = await assertAuthenticated()

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isPartner: true },
  })
  if (!me?.isPartner) {
    redirect("/dashboard")
  }

  const [clients, referral] = await Promise.all([
    getMyPartnerClients(),
    getMyReferralLink(),
  ])

  return (
    <PartnerConsoleView
      clients={Array.isArray(clients) ? clients : []}
      referralUrl={"url" in referral ? referral.url : null}
    />
  )
}

export default function PartnerConsolePage() {
  return (
    <Suspense>
      <PartnerConsoleContent />
    </Suspense>
  )
}
