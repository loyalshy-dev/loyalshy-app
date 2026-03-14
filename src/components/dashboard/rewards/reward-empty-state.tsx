import { Gift } from "lucide-react"
import { getTranslations } from "next-intl/server"

export async function RewardEmptyState() {
  const t = await getTranslations("dashboard.rewards")

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Gift className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[15px] font-medium">{t("noRewards")}</p>
        <p className="text-[13px] text-muted-foreground mt-1 max-w-[280px]">
          {t("noRewardsDescription")}
        </p>
      </div>
    </div>
  )
}
