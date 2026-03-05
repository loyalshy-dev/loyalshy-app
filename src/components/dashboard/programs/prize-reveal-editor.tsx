"use client"

import { useState, useMemo, useTransition, useCallback } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Loader2, RotateCcw, Plus, Trash2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { updateMinigameConfig } from "@/server/settings-actions"
import { parseMinigameConfig } from "@/lib/program-config"
import { ScratchCard, SlotMachine, WheelOfFortune } from "@/components/minigames"
import type { PrizeItem } from "@/types/program-types"

type PrizeRevealForm = {
  minigameEnabled: boolean
  minigameType: "scratch" | "slots" | "wheel"
}

type PrizeRevealProgram = {
  id: string
  name: string
  programType: string
  config: unknown
  rewardDescription: string
  status: string
  restaurantId: string
}

export function PrizeRevealEditor({ program }: { program: PrizeRevealProgram }) {
  const [isPending, startTransition] = useTransition()
  const isArchived = program.status === "ARCHIVED"
  const minigameConfig = parseMinigameConfig(program.config)

  const [previewKey, setPreviewKey] = useState(0)
  const handlePreviewReveal = useCallback(() => {}, [])

  // Game colors
  const [primaryColor, setPrimaryColor] = useState(minigameConfig?.primaryColor ?? "")
  const [accentColor, setAccentColor] = useState(minigameConfig?.accentColor ?? "")
  const [colorsChanged, setColorsChanged] = useState(false)

  // Prizes state (managed outside react-hook-form since it's a dynamic array)
  const [prizes, setPrizes] = useState<PrizeItem[]>(
    minigameConfig?.prizes?.length ? minigameConfig.prizes : []
  )
  const [prizesChanged, setPrizesChanged] = useState(false)

  const totalWeight = useMemo(() => prizes.reduce((sum, p) => sum + p.weight, 0), [prizes])

  const {
    register,
    handleSubmit,
    formState: { isDirty },
    watch,
    setValue,
    reset,
  } = useForm<PrizeRevealForm>({
    defaultValues: {
      minigameEnabled: minigameConfig?.enabled ?? false,
      minigameType: minigameConfig?.gameType ?? "scratch",
    },
  })

  const minigameEnabled = watch("minigameEnabled")
  const minigameType = watch("minigameType")

  // Preview text: first prize name or fallback to rewardDescription
  const prizeNames = prizes.map((p) => p.name).filter(Boolean)
  const previewRewardText = prizeNames.length > 0
    ? prizeNames[0]
    : program.rewardDescription || "Free reward!"

  function handleSave() {
    handleSubmit((data: PrizeRevealForm) => {
      startTransition(async () => {
        const filteredPrizes = prizes
          .filter((p) => p.name.trim())
          .map((p) => ({ name: p.name.trim(), weight: p.weight }))
        const result = await updateMinigameConfig({
          restaurantId: program.restaurantId,
          programId: program.id,
          enabled: data.minigameEnabled,
          gameType: data.minigameType,
          ...(filteredPrizes.length > 0 ? { prizes: filteredPrizes } : {}),
          ...(primaryColor ? { primaryColor } : {}),
          ...(accentColor ? { accentColor } : {}),
        })
        if ("error" in result) {
          toast.error(String(result.error))
        } else {
          reset(data)
          setPrizesChanged(false)
          setColorsChanged(false)
          toast.success("Prize reveal settings saved")
        }
      })
    })()
  }

  function addPrize() {
    if (prizes.length >= 8) return
    setPrizes([...prizes, { name: "", weight: 1 }])
    setPrizesChanged(true)
  }

  function updatePrizeName(index: number, value: string) {
    const updated = [...prizes]
    updated[index] = { ...updated[index], name: value }
    setPrizes(updated)
    setPrizesChanged(true)
  }

  function updatePrizeWeight(index: number, value: number) {
    const updated = [...prizes]
    updated[index] = { ...updated[index], weight: Math.max(1, Math.min(10, value)) }
    setPrizes(updated)
    setPrizesChanged(true)
  }

  function removePrize(index: number) {
    setPrizes(prizes.filter((_, i) => i !== index))
    setPrizesChanged(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Prize Reveal</h2>
        <p className="text-[13px] text-muted-foreground mt-1">
          Configure a fun minigame that plays when customers earn a reward.
        </p>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Reward Reveal Game</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Show a fun minigame when customers earn a reward
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            {...register("minigameEnabled")}
            disabled={isArchived}
          />
          <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-brand transition-colors after:content-[''] after:absolute after:top-0.5 after:inset-s-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      {/* Game selection + Prizes */}
      {minigameEnabled && (
        <div className="space-y-6">
          {/* Prizes section */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Prizes</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add prizes with weights (1–10) to control probability.
                {prizes.length === 0 && ` Falls back to "${program.rewardDescription}".`}
              </p>
            </div>

            {prizes.map((prize, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={prize.name}
                  onChange={(e) => updatePrizeName(i, e.target.value)}
                  placeholder="e.g. Free Drink"
                  maxLength={100}
                  disabled={isArchived}
                  className="text-[13px] flex-1"
                />
                <Input
                  type="number"
                  value={prize.weight}
                  onChange={(e) => updatePrizeWeight(i, parseInt(e.target.value) || 1)}
                  min={1}
                  max={10}
                  disabled={isArchived}
                  className="text-[13px] w-16 text-center shrink-0"
                  aria-label={`Weight for prize ${i + 1}`}
                />
                <span className="text-[11px] text-muted-foreground w-10 text-right shrink-0">
                  {totalWeight > 0 ? Math.round((prize.weight / totalWeight) * 100) : 0}%
                </span>
                {prizes.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removePrize(i)}
                    disabled={isArchived}
                    aria-label={`Remove prize ${i + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}

            {prizes.length < 8 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={addPrize}
                disabled={isArchived}
              >
                <Plus className="size-3" />
                Add prize
              </Button>
            )}
          </div>

          {/* Game Colors */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Game Colors</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customize colors for the minigame. Leave empty to use your brand color.
                </p>
              </div>
              {(primaryColor || accentColor) && (
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:text-foreground underline"
                  onClick={() => { setPrimaryColor(""); setAccentColor(""); setColorsChanged(true) }}
                >
                  Reset to default
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Primary</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor || "#6366f1"}
                    onChange={(e) => { setPrimaryColor(e.target.value); setColorsChanged(true) }}
                    disabled={isArchived}
                    className="size-8 rounded border border-border cursor-pointer p-0.5"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => { setPrimaryColor(e.target.value); setColorsChanged(true) }}
                    placeholder="var(--brand)"
                    maxLength={50}
                    disabled={isArchived}
                    className="text-[13px] font-mono flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Accent</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor || "#c4b5fd"}
                    onChange={(e) => { setAccentColor(e.target.value); setColorsChanged(true) }}
                    disabled={isArchived}
                    className="size-8 rounded border border-border cursor-pointer p-0.5"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => { setAccentColor(e.target.value); setColorsChanged(true) }}
                    placeholder="Default"
                    maxLength={50}
                    disabled={isArchived}
                    className="text-[13px] font-mono flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Game cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Select a game — try them all, then pick one
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] gap-1 text-muted-foreground"
                onClick={() => setPreviewKey((k) => k + 1)}
              >
                <RotateCcw className="h-3 w-3" />
                Reset all
              </Button>
            </div>

            {/* Hidden input for form registration */}
            <input type="hidden" {...register("minigameType")} />

            {/* Three game cards */}
            <div className="grid gap-3">
              {([
                { type: "scratch" as const, label: "Scratch Card" },
                { type: "slots" as const, label: "Slot Machine" },
                { type: "wheel" as const, label: "Wheel of Fortune" },
              ]).map(({ type, label }) => {
                const isSelected = minigameType === type
                return (
                  <div
                    key={type}
                    role="button"
                    tabIndex={isArchived ? -1 : 0}
                    onClick={() => { if (!isArchived) setValue("minigameType", type, { shouldDirty: true }) }}
                    onKeyDown={(e) => { if (!isArchived && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setValue("minigameType", type, { shouldDirty: true }) } }}
                    className={`relative rounded-xl border-2 p-4 text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-brand bg-brand/5 ring-1 ring-brand/20"
                        : "border-border bg-card hover:border-brand/30"
                    } ${isArchived ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {/* Header with radio + label */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <div
                        className={`size-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected ? "border-brand" : "border-muted-foreground/40"
                        }`}
                      >
                        {isSelected && (
                          <div className="size-2 rounded-full bg-brand" />
                        )}
                      </div>
                      <p className={`text-[13px] font-semibold ${isSelected ? "text-brand" : ""}`}>
                        {label}
                      </p>
                    </div>

                    {/* Interactive game preview */}
                    <div key={`${type}-${previewKey}`}>
                      {type === "scratch" && (
                        <ScratchCard
                          rewardText={previewRewardText}
                          onReveal={handlePreviewReveal}
                          primaryColor={primaryColor || undefined}
                          accentColor={accentColor || undefined}
                        />
                      )}
                      {type === "slots" && (
                        <SlotMachine
                          rewardText={previewRewardText}
                          enrollmentId={`preview-${type}-${program.id}`}
                          onReveal={handlePreviewReveal}
                          autoStart={false}
                          primaryColor={primaryColor || undefined}
                        />
                      )}
                      {type === "wheel" && (
                        <WheelOfFortune
                          rewardText={previewRewardText}
                          enrollmentId={`preview-${type}-${program.id}`}
                          onReveal={handlePreviewReveal}
                          prizes={prizeNames.length > 0 ? prizeNames : undefined}
                          primaryColor={primaryColor || undefined}
                          accentColor={accentColor || undefined}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Save button */}
      {(isDirty || prizesChanged || colorsChanged) && (
        <div className="flex items-center justify-end gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">Unsaved prize reveal changes</p>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isArchived || isPending}
            size="sm"
            className="gap-1.5"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Prize Settings
          </Button>
        </div>
      )}
    </div>
  )
}
