"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { createLoyaltyProgram } from "@/server/settings-actions"

export function CreateProgramForm({
  restaurantId,
  onCreated,
}: {
  restaurantId: string
  onCreated: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      name: "",
      visitsRequired: 10,
      rewardDescription: "",
      rewardExpiryDays: 90,
    },
  })

  function onSubmit(data: {
    name: string
    visitsRequired: number
    rewardDescription: string
    rewardExpiryDays: number
  }) {
    startTransition(async () => {
      const result = await createLoyaltyProgram({
        restaurantId,
        name: data.name,
        visitsRequired: data.visitsRequired,
        rewardDescription: data.rewardDescription,
        rewardExpiryDays: data.rewardExpiryDays,
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success("Program created")
        reset()
        onCreated()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="create-name">Program Name</Label>
          <Input
            id="create-name"
            {...register("name", { required: "Program name is required" })}
            placeholder="e.g., Coffee Loyalty, Lunch Special"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-visits">Visits Required</Label>
          <Input
            id="create-visits"
            type="number"
            min={3}
            max={30}
            {...register("visitsRequired", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-expiry">Reward Expiry (Days)</Label>
          <Input
            id="create-expiry"
            type="number"
            min={0}
            max={365}
            {...register("rewardExpiryDays", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="create-reward">Reward Description</Label>
          <Input
            id="create-reward"
            {...register("rewardDescription", {
              required: "Reward description is required",
            })}
            placeholder="e.g., Free coffee or dessert"
          />
          {errors.rewardDescription && (
            <p className="text-xs text-destructive">
              {errors.rewardDescription.message}
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              Creating...
            </>
          ) : (
            "Create Program"
          )}
        </Button>
      </div>
    </form>
  )
}
