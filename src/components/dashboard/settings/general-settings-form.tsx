"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Globe, Phone, MapPin } from "lucide-react"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { updateOrganizationProfile } from "@/server/org-settings-actions"
import { Card } from "@/components/ui/card"

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Helsinki",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Australia/Sydney",
]

type ProfileForm = {
  name: string
  address: string
  phone: string
  website: string
  timezone: string
}

type Organization = {
  id: string
  name: string
  slug: string
  logo: string | null
  brandColor: string | null
  secondaryColor: string | null
  address: string | null
  phone: string | null
  website: string | null
  timezone: string
}

export function GeneralSettingsForm({ organization }: { organization: Organization }) {
  const t = useTranslations("dashboard.settingsForms")
  const tSettings = useTranslations("dashboard.settings")
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    defaultValues: {
      name: organization.name,
      address: organization.address ?? "",
      phone: organization.phone ?? "",
      website: organization.website ?? "",
      timezone: organization.timezone,
    },
  })

  function onSubmit(data: ProfileForm) {
    startTransition(async () => {
      const result = await updateOrganizationProfile({
        organizationId: organization.id,
        ...data,
      })
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success(t("saved"))
      }
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Organization Profile */}
        <Card>
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">{tSettings("orgProfile")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tSettings("orgProfileDescription")}
            </p>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">{tSettings("orgName")} *</Label>
                <Input
                  id="name"
                  {...register("name", { required: tSettings("orgNameRequired") })}
                  placeholder={tSettings("orgNamePlaceholder")}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {tSettings("address")}
                </Label>
                <Input
                  id="address"
                  {...register("address")}
                  placeholder={tSettings("addressPlaceholder")}
                />
                {errors.address && (
                  <p className="text-xs text-destructive">{errors.address.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Phone
                </Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Website
                </Label>
                <Input
                  id="website"
                  {...register("website")}
                  placeholder="https://myorganization.com"
                />
                {errors.website && (
                  <p className="text-xs text-destructive">{errors.website.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  {...register("timezone")}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex items-center justify-between">
          <div>
            {isDirty && (
              <p className="text-xs text-warning font-medium">You have unsaved changes</p>
            )}
          </div>
          <Button
            type="submit"
            disabled={isPending || !isDirty}
            size="sm"
          >
            {isPending ? t("saved") : "Save changes"}
          </Button>
        </div>
      </form>

    </div>
  )
}
