import { Card } from "@/components/ui/card"

const passTypeConfig: Record<string, { label: string; color: string }> = {
  STAMP_CARD: { label: "Stamp Card", color: "bg-blue-500" },
  COUPON: { label: "Coupon", color: "bg-green-500" },
  MEMBERSHIP: { label: "Membership", color: "bg-violet-500" },
  POINTS: { label: "Points", color: "bg-amber-500" },
  PREPAID: { label: "Prepaid", color: "bg-cyan-500" },
  GIFT_CARD: { label: "Gift Card", color: "bg-pink-500" },
  TICKET: { label: "Ticket", color: "bg-orange-500" },
  ACCESS: { label: "Access", color: "bg-indigo-500" },
  TRANSIT: { label: "Transit", color: "bg-teal-500" },
  BUSINESS_ID: { label: "Business ID", color: "bg-slate-500" },
}

type PassTypeBreakdownProps = {
  data: { passType: string; count: number }[]
}

export function PassTypeBreakdown({ data }: PassTypeBreakdownProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  if (total === 0) {
    return (
      <Card className="p-5 space-y-4">
        <h3 className="text-[13px] font-medium text-muted-foreground">
          Pass Types
        </h3>
        <p className="text-sm text-muted-foreground">No programs created yet.</p>
      </Card>
    )
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium text-muted-foreground">
          Pass Types
        </h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {total} total
        </span>
      </div>
      <div className="space-y-3">
        {data.map(({ passType, count }) => {
          const config = passTypeConfig[passType]
          const pct = Math.round((count / total) * 100)

          return (
            <div key={passType} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{config?.label ?? passType}</span>
                <span className="text-muted-foreground tabular-nums">
                  {count} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${config?.color ?? "bg-muted-foreground"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
