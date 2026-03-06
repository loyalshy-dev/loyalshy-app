"use client"

import { useRef, useTransition } from "react"
import { UserPlus, Loader2, AlertCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { addContact } from "@/server/contact-actions"

const schema = z.object({
  fullName: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
})

type FormValues = z.infer<typeof schema>

type AddCustomerSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddCustomerSheet({ open, onOpenChange }: AddCustomerSheetProps) {
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<FormValues>({
    defaultValues: { fullName: "", email: "", phone: "" },
  })

  function onSubmit(data: FormValues) {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("fullName", data.fullName)
      formData.set("email", data.email ?? "")
      formData.set("phone", data.phone ?? "")

      const result = await addContact(formData)

      if (!result.success) {
        if (result.duplicateField) {
          setError(result.duplicateField, { message: result.error })
        } else {
          toast.error(result.error ?? "Failed to add customer")
        }
        return
      }

      toast.success(`${data.fullName} added successfully`)
      reset()
      onOpenChange(false)
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand/10">
              <UserPlus className="size-4 text-brand" />
            </div>
            <div>
              <SheetTitle className="text-base">Add Customer</SheetTitle>
              <SheetDescription className="text-[13px]">
                Add a new customer to your loyalty program.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form
          ref={formRef}
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 px-1"
        >
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-[13px]">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              className="h-9 text-[13px]"
              autoFocus
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? "fullName-error" : undefined}
              {...register("fullName", { required: "Name is required" })}
            />
            {errors.fullName && (
              <p id="fullName-error" className="flex items-center gap-1 text-[11px] text-destructive" role="alert">
                <AlertCircle className="size-3" />
                {errors.fullName.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[13px]">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              className="h-9 text-[13px]"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className="flex items-center gap-1 text-[11px] text-destructive" role="alert">
                <AlertCircle className="size-3" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-[13px]">
              Phone
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              className="h-9 text-[13px]"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone-error" : undefined}
              {...register("phone")}
            />
            {errors.phone && (
              <p id="phone-error" className="flex items-center gap-1 text-[11px] text-destructive" role="alert">
                <AlertCircle className="size-3" />
                {errors.phone.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
              className="text-[13px]"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="gap-1.5 text-[13px]">
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <UserPlus className="size-3.5" />
              )}
              Add Customer
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
