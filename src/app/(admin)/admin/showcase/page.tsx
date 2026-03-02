import { connection } from "next/server"
import { getShowcaseCards } from "@/server/showcase-actions"
import { ShowcaseCardsView } from "@/components/admin/showcase/showcase-cards-view"

export default async function ShowcasePage() {
  await connection()
  const cards = await getShowcaseCards()

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Showcase Cards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the loyalty card examples shown on the marketing landing page.
        </p>
      </div>
      <ShowcaseCardsView initialCards={cards} />
    </div>
  )
}
