import { Gift } from "lucide-react"

export function RewardEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Gift className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[15px] font-medium">No rewards yet</p>
        <p className="text-[13px] text-muted-foreground mt-1 max-w-[280px]">
          Rewards are automatically created when customers complete their
          loyalty card. Register visits to get started.
        </p>
      </div>
    </div>
  )
}
