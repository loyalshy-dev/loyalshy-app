import { Suspense } from "react"
import { InviteForm } from "./invite-form"

type Params = Promise<{ token: string }>

export default async function InvitePage({ params }: { params: Params }) {
  const { token } = await params

  return (
    <Suspense fallback={<InviteLoading />}>
      <InviteForm token={token} />
    </Suspense>
  )
}

function InviteLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <svg
        className="size-4 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="ml-2 text-muted-foreground">Loading...</span>
    </div>
  )
}
