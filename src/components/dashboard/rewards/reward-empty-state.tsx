import { Gift } from "lucide-react"
import { useTranslations } from "next-intl"

export function RewardEmptyState() {
  const t = useTranslations("dashboard.rewards")

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Gift className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[15px] font-medium">{t("noRewards")}</p>
        <p className="text-[13px] text-muted-foreground mt-1 max-w-70">
          {t("noRewardsDescription")}
        </p>
      </div>
    </div>
  )
}
