"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Globe, Phone, MapPin, Shield, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { updateOrganizationProfile, updateJoinRequirement } from "@/server/org-settings-actions"
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

type JoinRequirement = "email_or_phone" | "email_only"

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
  settings: Record<string, unknown>
}

export function GeneralSettingsForm({ organization }: { organization: Organization }) {
  const [isPending, startTransition] = useTransition()
  const [isJoinPending, startJoinTransition] = useTransition()
  const [joinRequirement, setJoinRequirement] = useState<JoinRequirement>(
    (organization.settings?.joinRequirement as JoinRequirement) ?? "email_or_phone"
  )

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
        toast.success("Organization profile updated")
      }
    })
  }

  function handleJoinRequirementChange(value: JoinRequirement) {
    setJoinRequirement(value)
    startJoinTransition(async () => {
      const result = await updateJoinRequirement({
        organizationId: organization.id,
        joinRequirement: value,
      })
      if (!result.success) {
        toast.error(result.error ?? "Failed to update setting")
        setJoinRequirement(joinRequirement) // revert
      } else {
        toast.success("Join form setting updated")
      }
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Organization Profile */}
        <Card>
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">Organization Profile</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Basic information about your organization.
            </p>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Organization Name *</Label>
                <Input
                  id="name"
                  {...register("name", { required: "Organization name is required" })}
                  placeholder="My Organization"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  Address
                </Label>
                <Input
                  id="address"
                  {...register("address")}
                  placeholder="123 Main St, City, State"
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
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>

      {/* Join Form Settings — separate from the profile form */}
      <Card>
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Public Join Form</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Control what information is required when contacts join via QR code or link.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <Label className="text-[13px]">Contact identification requirement</Label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="joinRequirement"
                  value="email_or_phone"
                  checked={joinRequirement === "email_or_phone"}
                  onChange={() => handleJoinRequirementChange("email_or_phone")}
                  disabled={isJoinPending}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-[13px] font-medium">Email or phone</span>
                  <p className="text-[12px] text-muted-foreground">
                    Contacts must provide at least an email or phone number. Lower friction, but allows different identifiers per visit.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="joinRequirement"
                  value="email_only"
                  checked={joinRequirement === "email_only"}
                  onChange={() => handleJoinRequirementChange("email_only")}
                  disabled={isJoinPending}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-[13px] font-medium">Email required</span>
                  <p className="text-[12px] text-muted-foreground">
                    Contacts must provide an email address. Stronger deduplication and allows you to send pass notifications.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Info className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[12px] text-muted-foreground">
              For maximum control, use <strong>Direct Issue</strong> in the Distribution tab to personally create and deliver passes to specific contacts via email.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
