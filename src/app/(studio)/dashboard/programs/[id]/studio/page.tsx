import { redirect } from "next/navigation"

export default async function StudioPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id: programId } = await props.params
  redirect(`/dashboard/programs/${programId}/design`)
}
