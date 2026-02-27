import { connection } from "next/server"
import { notFound } from "next/navigation"
import { assertAuthenticated } from "@/lib/dal"
import { getProgramDetail } from "@/server/program-actions"
import { Users, Stamp, Gift, CheckCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { statusConfig } from "@/components/dashboard/programs/program-status"
import { format } from "date-fns"

export default async function ProgramOverviewPage(props: {
  params: Promise<{ id: string }>
}) {
  await connection()
  const { id: programId } = await props.params
  await assertAuthenticated()

  const program = await getProgramDetail(programId)
  if (!program) {
    notFound()
  }

  const cfg = statusConfig[program.status] ?? statusConfig.DRAFT

  const stats = [
    {
      label: "Enrollments",
      value: program.enrollmentCount,
      sub: `${program.activeEnrollmentCount} active`,
      icon: Users,
    },
    {
      label: "Total Visits",
      value: program.totalVisits,
      sub: `${program.visitsRequired} required`,
      icon: Stamp,
    },
    {
      label: "Available Rewards",
      value: program.availableRewards,
      sub: "pending redemption",
      icon: Gift,
    },
    {
      label: "Redeemed Rewards",
      value: program.redeemedRewards,
      sub: "all time",
      icon: CheckCircle,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {stat.label}
              </p>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold tracking-tight mt-1">
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Program details */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold mb-4">Program Details</h2>
        <dl className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Reward</dt>
            <dd className="mt-0.5 font-medium">{program.rewardDescription}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Visits Required</dt>
            <dd className="mt-0.5 font-medium">{program.visitsRequired}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Reward Expiry</dt>
            <dd className="mt-0.5 font-medium">
              {program.rewardExpiryDays === 0
                ? "Never expires"
                : `${program.rewardExpiryDays} days`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Start Date</dt>
            <dd className="mt-0.5 font-medium">
              {format(new Date(program.startsAt), "MMM d, yyyy")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">End Date</dt>
            <dd className="mt-0.5 font-medium">
              {program.endsAt
                ? format(new Date(program.endsAt), "MMM d, yyyy")
                : "Open-ended"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Created</dt>
            <dd className="mt-0.5 font-medium">
              {format(new Date(program.createdAt), "MMM d, yyyy")}
            </dd>
          </div>
          {program.termsAndConditions && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-xs">
                Terms & Conditions
              </dt>
              <dd className="mt-0.5 text-muted-foreground whitespace-pre-wrap">
                {program.termsAndConditions}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
