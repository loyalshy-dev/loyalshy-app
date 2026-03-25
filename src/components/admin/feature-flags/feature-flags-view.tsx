"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { PASS_TYPE_META, type PassType } from "@/types/pass-types"
import { ALL_PASS_TYPES, type PassType as PlanPassType } from "@/lib/plans"
import { updateFeatureFlags } from "@/server/admin-actions"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

type FeatureFlagsViewProps = {
  disabledPassTypes: PlanPassType[]
}

export function FeatureFlagsView({ disabledPassTypes }: FeatureFlagsViewProps) {
  const t = useTranslations("admin.featureFlags")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [disabled, setDisabled] = useState<Set<string>>(new Set(disabledPassTypes))
  const [hasChanges, setHasChanges] = useState(false)

  function toggle(passType: string) {
    setDisabled((prev) => {
      const next = new Set(prev)
      if (next.has(passType)) {
        next.delete(passType)
      } else {
        next.add(passType)
      }
      return next
    })
    setHasChanges(true)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateFeatureFlags({
        disabledPassTypes: Array.from(disabled),
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success(t("saved"))
        setHasChanges(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("description")}
          </p>
        </div>
        {hasChanges && (
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            {t("save")}
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border divide-y divide-border">
        {ALL_PASS_TYPES.map((type) => {
          const meta = PASS_TYPE_META[type as PassType]
          const Icon = meta.icon
          const isDisabled = disabled.has(type)

          return (
            <div
              key={type}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-8 rounded-md bg-muted/60">
                  <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[13px] font-medium">{meta.label}</p>
                  <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isDisabled && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {t("comingSoon")}
                  </Badge>
                )}
                <Switch
                  checked={!isDisabled}
                  onCheckedChange={() => toggle(type)}
                  aria-label={`${meta.label} ${t("toggle")}`}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t("hint")}
      </p>
    </div>
  )
}
