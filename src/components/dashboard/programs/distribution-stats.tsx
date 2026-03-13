import { Users, TrendingUp, UserPlus } from "lucide-react"
import { Card } from "@/components/ui/card"

type DistributionStatsProps = {
  totalIssued: number
  issuedThisWeek: number
  eligibleContacts: number
}

export function DistributionStats({
  totalIssued,
  issuedThisWeek,
  eligibleContacts,
}: DistributionStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="size-3.5 text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground font-medium">
            Total issued
          </span>
        </div>
        <p className="text-2xl font-semibold tabular-nums">{totalIssued}</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="size-3.5 text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground font-medium">
            This week
          </span>
        </div>
        <p className="text-2xl font-semibold tabular-nums">{issuedThisWeek}</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="size-3.5 text-muted-foreground" />
          <span className="text-[12px] text-muted-foreground font-medium">
            Eligible
          </span>
        </div>
        <p className="text-2xl font-semibold tabular-nums">
          {eligibleContacts}
        </p>
      </Card>
    </div>
  )
}
