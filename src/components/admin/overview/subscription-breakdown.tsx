import { Badge } from "@/components/ui/badge"

const statusConfig: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: "Active",
    className: "bg-success/10 text-success border-success/20",
  },
  TRIALING: {
    label: "Trialing",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  PAST_DUE: {
    label: "Past Due",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  CANCELED: {
    label: "Canceled",
    className: "bg-muted text-muted-foreground border-border",
  },
}

type SubscriptionBreakdownProps = {
  data: { status: string; count: number }[]
}

export function SubscriptionBreakdown({ data }: SubscriptionBreakdownProps) {
  const allStatuses = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELED"]
  const countMap = new Map(data.map((d) => [d.status, d.count]))

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <h3 className="text-[13px] font-medium text-muted-foreground">
        Subscription Status
      </h3>
      <div className="space-y-3">
        {allStatuses.map((status) => {
          const config = statusConfig[status]
          const count = countMap.get(status) ?? 0

          return (
            <div key={status} className="flex items-center justify-between">
              <Badge
                variant="outline"
                className={`text-[11px] ${config?.className ?? ""}`}
              >
                {config?.label ?? status}
              </Badge>
              <span className="text-sm font-medium tabular-nums">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
