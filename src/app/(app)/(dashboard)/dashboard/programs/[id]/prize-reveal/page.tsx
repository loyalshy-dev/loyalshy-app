import { redirect } from "next/navigation"

export default async function PrizeRevealPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  redirect(`/dashboard/programs/${id}/settings`)
}
