import { Suspense } from "react"
import { connection } from "next/server"
import { notFound } from "next/navigation"
import { assertAuthenticated, getRestaurantForUser } from "@/lib/dal"
import { db } from "@/lib/db"
import { ProgramTabNav } from "@/components/dashboard/programs/program-tab-nav"
import { Skeleton } from "@/components/ui/skeleton"

async function ProgramLayoutInner({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  await connection()
  const { id: programId } = await params
  const session = await assertAuthenticated()

  const restaurant = await getRestaurantForUser()
  if (!restaurant) {
    notFound()
  }

  // Validate program belongs to this restaurant
  const program = await db.loyaltyProgram.findFirst({
    where: { id: programId, restaurantId: restaurant.id },
    select: { id: true, name: true, status: true },
  })

  if (!program) {
    notFound()
  }

  // Compute isOwner
  let isOwner = false
  if (session.user.role === "super_admin") {
    isOwner = true
  } else {
    const org = await db.organization.findUnique({
      where: { slug: restaurant.slug },
      select: { id: true },
    })
    if (org) {
      const member = await db.member.findFirst({
        where: { organizationId: org.id, userId: session.user.id },
        select: { role: true },
      })
      isOwner = member?.role === "owner"
    }
  }

  return (
    <div className="space-y-6">
      <ProgramTabNav
        programId={program.id}
        programName={program.name}
        programStatus={program.status}
        isOwner={isOwner}
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  )
}

export default function ProgramLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-full max-w-md" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      }
    >
      <ProgramLayoutInner params={params}>{children}</ProgramLayoutInner>
    </Suspense>
  )
}
