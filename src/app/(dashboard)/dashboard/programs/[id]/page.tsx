import { connection } from "next/server"
import { notFound } from "next/navigation"
import { assertAuthenticated } from "@/lib/dal"
import { getProgramDetail } from "@/server/program-actions"
import { Users, Stamp, Gift, CheckCircle, Ticket, Crown, Clock } from "lucide-react"
import { statusConfig } from "@/components/dashboard/programs/program-status"
import { format } from "date-fns"
import { parseCouponConfig, parseMembershipConfig, formatCouponValue, formatMembershipDuration } from "@/lib/program-config"
import { PROGRAM_TYPE_META, type ProgramType } from "@/types/program-types"
import type { CouponConfig, MembershipConfig } from "@/types/program-types"

function StampCardStats({ program }: { program: NonNullable<Awaited<ReturnType<typeof getProgramDetail>>> }) {
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
  )
}

function CouponStats({ program, config }: { program: NonNullable<Awaited<ReturnType<typeof getProgramDetail>>>, config: CouponConfig | null }) {
  const stats = [
    {
      label: "Coupons Issued",
      value: program.enrollmentCount,
      sub: `${program.activeEnrollmentCount} active`,
      icon: Ticket,
    },
    {
      label: "Redeemed",
      value: program.redeemedRewards,
      sub: "all time",
      icon: CheckCircle,
    },
    {
      label: "Pending",
      value: program.availableRewards,
      sub: "awaiting redemption",
      icon: Clock,
    },
    {
      label: "Discount",
      value: config ? formatCouponValue(config) : "-",
      sub: config?.redemptionLimit === "unlimited" ? "unlimited use" : "single use",
      icon: Gift,
    },
  ]

  return (
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
  )
}

function MembershipStats({ program, config }: { program: NonNullable<Awaited<ReturnType<typeof getProgramDetail>>>, config: MembershipConfig | null }) {
  const stats = [
    {
      label: "Total Members",
      value: program.enrollmentCount,
      sub: `${program.activeEnrollmentCount} active`,
      icon: Users,
    },
    {
      label: "Active Members",
      value: program.activeEnrollmentCount,
      sub: "currently enrolled",
      icon: Crown,
    },
    {
      label: "Check-ins",
      value: program.totalVisits,
      sub: "all time",
      icon: CheckCircle,
    },
    {
      label: "Tier",
      value: config?.membershipTier ?? "-",
      sub: config ? formatMembershipDuration(config) : "-",
      icon: Gift,
    },
  ]

  return (
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
  )
}

function StampCardDetails({ program }: { program: NonNullable<Awaited<ReturnType<typeof getProgramDetail>>> }) {
  return (
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
    </dl>
  )
}

function CouponDetails({ config }: { config: CouponConfig | null }) {
  if (!config) return null
  return (
    <dl className="grid gap-4 sm:grid-cols-2 text-sm">
      <div>
        <dt className="text-muted-foreground text-xs">Discount</dt>
        <dd className="mt-0.5 font-medium">{formatCouponValue(config)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Redemption Limit</dt>
        <dd className="mt-0.5 font-medium">
          {config.redemptionLimit === "unlimited" ? "Unlimited" : "Single Use"}
        </dd>
      </div>
      {config.validUntil && (
        <div>
          <dt className="text-muted-foreground text-xs">Valid Until</dt>
          <dd className="mt-0.5 font-medium">
            {format(new Date(config.validUntil), "MMM d, yyyy")}
          </dd>
        </div>
      )}
      {config.couponDescription && (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground text-xs">Description</dt>
          <dd className="mt-0.5 text-muted-foreground">{config.couponDescription}</dd>
        </div>
      )}
      {config.terms && (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground text-xs">Terms</dt>
          <dd className="mt-0.5 text-muted-foreground whitespace-pre-wrap">{config.terms}</dd>
        </div>
      )}
    </dl>
  )
}

function MembershipDetails({ config }: { config: MembershipConfig | null }) {
  if (!config) return null
  return (
    <dl className="grid gap-4 sm:grid-cols-2 text-sm">
      <div>
        <dt className="text-muted-foreground text-xs">Tier</dt>
        <dd className="mt-0.5 font-medium">{config.membershipTier}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Duration</dt>
        <dd className="mt-0.5 font-medium">{formatMembershipDuration(config)}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-muted-foreground text-xs">Benefits</dt>
        <dd className="mt-0.5 text-muted-foreground whitespace-pre-wrap">{config.benefits}</dd>
      </div>
      {config.terms && (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground text-xs">Terms</dt>
          <dd className="mt-0.5 text-muted-foreground whitespace-pre-wrap">{config.terms}</dd>
        </div>
      )}
    </dl>
  )
}

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

  const programType = (program.programType ?? "STAMP_CARD") as ProgramType
  const typeMeta = PROGRAM_TYPE_META[programType]
  const couponConfig = programType === "COUPON" ? parseCouponConfig(program.config) : null
  const membershipConfig = programType === "MEMBERSHIP" ? parseMembershipConfig(program.config) : null

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      {programType === "STAMP_CARD" && <StampCardStats program={program} />}
      {programType === "COUPON" && <CouponStats program={program} config={couponConfig} />}
      {programType === "MEMBERSHIP" && <MembershipStats program={program} config={membershipConfig} />}

      {/* Program details */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold">Program Details</h2>
          {typeMeta && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <typeMeta.icon className="h-3 w-3" />
              {typeMeta.shortLabel}
            </span>
          )}
        </div>

        {/* Type-specific details */}
        {programType === "STAMP_CARD" && <StampCardDetails program={program} />}
        {programType === "COUPON" && <CouponDetails config={couponConfig} />}
        {programType === "MEMBERSHIP" && <MembershipDetails config={membershipConfig} />}

        {/* Shared dates */}
        <dl className="grid gap-4 sm:grid-cols-2 text-sm mt-4 pt-4 border-t border-border">
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
          {program.termsAndConditions && programType === "STAMP_CARD" && (
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
