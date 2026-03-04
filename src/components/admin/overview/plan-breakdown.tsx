const planConfig: Record<string, { label: string; color: string }> = {
  STARTER: { label: "Starter", color: "bg-muted-foreground/60" },
  GROWTH: { label: "Growth", color: "bg-blue-500" },
  SCALE: { label: "Scale", color: "bg-violet-500" },
  ENTERPRISE: { label: "Enterprise", color: "bg-amber-500" },
}

type PlanBreakdownProps = {
  data: { plan: string; count: number }[]
}

export function PlanBreakdown({ data }: PlanBreakdownProps) {
  const allPlans = ["STARTER", "GROWTH", "SCALE", "ENTERPRISE"]
  const countMap = new Map(data.map((d) => [d.plan, d.count]))
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <h3 className="text-[13px] font-medium text-muted-foreground">
        Plan Distribution
      </h3>
      <div className="space-y-3">
        {allPlans.map((plan) => {
          const config = planConfig[plan]
          const count = countMap.get(plan) ?? 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0

          return (
            <div key={plan} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{config?.label ?? plan}</span>
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
    </div>
  )
}
