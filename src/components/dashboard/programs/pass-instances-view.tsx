"use client"

import { useCallback, useState, useTransition, useRef, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  Users,
  Search,
  Smartphone,
  Apple,
  ChevronLeft,
  ChevronRight,
  Wallet,
  CheckCircle,
  PauseCircle,
  XCircle,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Ban,
  Undo2,
  Mail,
  Plus,
  Loader2,
  X,
  MailX,
  Pencil,
  AlertCircle,
  UserCircle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import {
  parseCouponConfig,
  parseMembershipConfig,
  parsePointsConfig,
  parsePrepaidConfig,
  formatCouponValue,
} from "@/lib/pass-config"
import type { PassInstanceListItem, PassInstanceStats } from "@/server/template-actions"
import { updatePassInstanceStatus } from "@/server/template-actions"
import {
  sendPassEmail,
  searchContactsForIssue,
  issuePassToContacts,
  createContactAndIssuePass,
  uploadInstanceHolderPhoto,
  type DirectIssueContact,
  type IssueContactResult,
} from "@/server/distribution-actions"
import { updateContact } from "@/server/contact-actions"
import { Label } from "@/components/ui/label"

// ─── Props ─────────────────────────────────────────────────────

type PassInstancesViewProps = {
  result: {
    items: PassInstanceListItem[]
    total: number
    page: number
    perPage: number
  }
  stats: PassInstanceStats
  templateId: string
  passType: string
  templateConfig: unknown
  search: string
  status: string
  page: number
}

// ─── Status styles ─────────────────────────────────────────────

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  COMPLETED: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  SUSPENDED: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  EXPIRED: "bg-muted text-muted-foreground",
  REVOKED: "bg-red-500/10 text-red-700 dark:text-red-400",
  VOIDED: "bg-muted text-muted-foreground line-through",
}

// ─── Type-aware helpers ────────────────────────────────────────

function getProgressColumnHeader(passType: string): string {
  switch (passType) {
    case "STAMP_CARD": return "Progress"
    case "COUPON": return "Status"
    case "MEMBERSHIP": return "Check-ins"
    case "POINTS": return "Balance"
    case "PREPAID": return "Remaining"
    case "GIFT_CARD": return "Balance"
    case "TICKET": return "Scans"
    case "ACCESS": return "Granted"
    case "TRANSIT": return "Status"
    case "BUSINESS_ID": return "Verified"
    default: return "Activity"
  }
}

function getProgressValue(
  passType: string,
  data: unknown,
  templateConfig: unknown
): { text: string; progress?: number } {
  const d = (data ?? {}) as Record<string, unknown>

  switch (passType) {
    case "STAMP_CARD": {
      const current = (d.currentCycleVisits as number) ?? 0
      const cfg = (templateConfig ?? {}) as Record<string, unknown>
      const required = (cfg.stampsRequired as number) ?? 10
      return {
        text: `${current}/${required}`,
        progress: required > 0 ? current / required : 0,
      }
    }
    case "COUPON": {
      const redeemed = d.redeemed as boolean
      return { text: redeemed ? "Redeemed" : "Available" }
    }
    case "MEMBERSHIP": {
      const checkIns = (d.totalCheckIns as number) ?? 0
      return { text: `${checkIns}` }
    }
    case "POINTS": {
      const balance = (d.pointsBalance as number) ?? 0
      const config = parsePointsConfig(templateConfig)
      const label = config?.pointsLabel ?? "pts"
      return { text: `${balance.toLocaleString()} ${label}` }
    }
    case "PREPAID": {
      const remaining = (d.remainingUses as number) ?? 0
      const config = parsePrepaidConfig(templateConfig)
      const total = config?.totalUses ?? 0
      return {
        text: `${remaining}/${total}`,
        progress: total > 0 ? remaining / total : 0,
      }
    }
    case "GIFT_CARD": {
      const balanceCents = (d.balanceCents as number) ?? 0
      const currency = (d.currency as string) ?? "USD"
      return { text: `${(balanceCents / 100).toFixed(2)} ${currency}` }
    }
    case "TICKET": {
      const scans = (d.scanCount as number) ?? 0
      return { text: `${scans}` }
    }
    case "ACCESS": {
      const granted = (d.totalGranted as number) ?? 0
      return { text: `${granted}` }
    }
    case "TRANSIT": {
      const isBoarded = d.isBoarded as boolean
      return { text: isBoarded ? "In transit" : "Idle" }
    }
    case "BUSINESS_ID": {
      const verifications = (d.totalVerifications as number) ?? 0
      return { text: `${verifications}` }
    }
    default:
      return { text: "—" }
  }
}

// ─── Stat card ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">
        {value}
      </p>
    </Card>
  )
}

// ─── Mini progress bar ─────────────────────────────────────────

function MiniProgressBar({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, 0), 1)
  return (
    <div className="w-16 h-1.5 rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-brand transition-all"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}

// ─── Wallet icon ───────────────────────────────────────────────

function WalletIcon({ provider }: { provider: string }) {
  if (provider === "APPLE") return <Apple className="size-3.5" />
  if (provider === "GOOGLE") return <Smartphone className="size-3.5" />
  return null
}

// ─── Edit contact sheet ───────────────────────────────────────

function EditContactSheet({
  open,
  onOpenChange,
  contact,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: { id: string; fullName: string; email: string | null; phone: string | null }
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState(contact.fullName)
  const [email, setEmail] = useState(contact.email ?? "")
  const [phone, setPhone] = useState(contact.phone ?? "")
  const [isPending, startTransition] = useTransition()
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null)

  // Sync state when contact changes
  useEffect(() => {
    setFullName(contact.fullName)
    setEmail(contact.email ?? "")
    setPhone(contact.phone ?? "")
    setFieldError(null)
  }, [contact])

  function handleSave() {
    if (!fullName.trim()) {
      setFieldError({ field: "fullName", message: "Name is required" })
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set("contactId", contact.id)
      formData.set("fullName", fullName)
      formData.set("email", email)
      formData.set("phone", phone)

      const result = await updateContact(formData)

      if (!result.success) {
        if (result.duplicateField) {
          setFieldError({ field: result.duplicateField, message: result.error ?? "Duplicate" })
        } else {
          toast.error(result.error ?? "Failed to update contact")
        }
        return
      }

      toast.success("Contact updated")
      onOpenChange(false)
      onSaved()
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand/10">
              <Pencil className="size-4 text-brand" />
            </div>
            <div>
              <SheetTitle className="text-base">Edit Contact</SheetTitle>
              <SheetDescription className="text-[13px]">
                Update contact details for {contact.fullName}.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name" className="text-[13px]">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-name"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setFieldError(null) }}
              placeholder="John Doe"
              className="h-9 text-[13px]"
              autoFocus
              aria-invalid={fieldError?.field === "fullName"}
              aria-describedby={fieldError?.field === "fullName" ? "edit-name-error" : undefined}
            />
            {fieldError?.field === "fullName" && (
              <p id="edit-name-error" className="flex items-center gap-1 text-[11px] text-destructive" role="alert">
                <AlertCircle className="size-3" />
                {fieldError.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-email" className="text-[13px]">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldError(null) }}
              placeholder="john@example.com"
              className="h-9 text-[13px]"
              aria-invalid={fieldError?.field === "email"}
              aria-describedby={fieldError?.field === "email" ? "edit-email-error" : undefined}
            />
            {fieldError?.field === "email" && (
              <p id="edit-email-error" className="flex items-center gap-1 text-[11px] text-destructive" role="alert">
                <AlertCircle className="size-3" />
                {fieldError.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-phone" className="text-[13px]">Phone</Label>
            <Input
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setFieldError(null) }}
              placeholder="+1 (555) 123-4567"
              className="h-9 text-[13px]"
              aria-invalid={fieldError?.field === "phone"}
              aria-describedby={fieldError?.field === "phone" ? "edit-phone-error" : undefined}
            />
            {fieldError?.field === "phone" && (
              <p id="edit-phone-error" className="flex items-center gap-1 text-[11px] text-destructive" role="alert">
                <AlertCircle className="size-3" />
                {fieldError.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-[13px]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!fullName.trim() || isPending}
              onClick={handleSave}
              className="gap-1.5 text-[13px]"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Pencil className="size-3.5" />
              )}
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Row actions ───────────────────────────────────────────────

const HOLDER_PHOTO_PASS_TYPES = ["BUSINESS_ID", "MEMBERSHIP", "ACCESS"]

function RowActions({
  passInstanceId,
  currentStatus,
  contactEmail,
  passType,
  onStatusChange,
  onEditContact,
}: {
  passInstanceId: string
  currentStatus: string
  contactEmail: string | null
  passType: string
  onStatusChange: () => void
  onEditContact: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const photoInputRef = useRef<HTMLInputElement>(null)

  function handleAction(newStatus: "ACTIVE" | "SUSPENDED" | "REVOKED") {
    startTransition(async () => {
      const result = await updatePassInstanceStatus(passInstanceId, newStatus)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        const labels = { ACTIVE: "activated", SUSPENDED: "suspended", REVOKED: "revoked" }
        toast.success(`Pass ${labels[newStatus]}`)
        onStatusChange()
      }
    })
  }

  function handleSendEmail() {
    startTransition(async () => {
      const result = await sendPassEmail(passInstanceId)
      if (result.success) {
        toast.success("Pass email sent")
      } else {
        toast.error(result.error ?? "Failed to send email")
      }
    })
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    startTransition(async () => {
      const fd = new FormData()
      fd.append("passInstanceId", passInstanceId)
      fd.append("file", file)
      const result = await uploadInstanceHolderPhoto(fd)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Holder photo uploaded")
        onStatusChange()
      }
    })
    if (photoInputRef.current) photoInputRef.current.value = ""
  }

  return (
    <>
      {HOLDER_PHOTO_PASS_TYPES.includes(passType) && (
        <input
          ref={photoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handlePhotoUpload}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isPending}
            aria-label="Pass actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onEditContact}>
            <Pencil className="size-3.5 mr-2" />
            Edit contact
          </DropdownMenuItem>
          {HOLDER_PHOTO_PASS_TYPES.includes(passType) && (
            <DropdownMenuItem onClick={() => photoInputRef.current?.click()}>
              <UserCircle className="size-3.5 mr-2" />
              Upload holder photo
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={handleSendEmail}
            disabled={!contactEmail}
          >
            <Mail className="size-3.5 mr-2" />
            {contactEmail ? "Send pass email" : "No email on file"}
          </DropdownMenuItem>
          {currentStatus === "SUSPENDED" && (
            <DropdownMenuItem onClick={() => handleAction("ACTIVE")}>
              <Undo2 className="size-3.5 mr-2" />
              Reactivate
            </DropdownMenuItem>
          )}
          {currentStatus === "ACTIVE" && (
            <DropdownMenuItem onClick={() => handleAction("SUSPENDED")}>
              <ShieldOff className="size-3.5 mr-2" />
              Suspend
            </DropdownMenuItem>
          )}
          {(currentStatus === "ACTIVE" || currentStatus === "SUSPENDED") && (
            <DropdownMenuItem
              onClick={() => handleAction("REVOKED")}
              className="text-destructive focus:text-destructive"
            >
              <Ban className="size-3.5 mr-2" />
              Revoke
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

// ─── Issue pass sheet ─────────────────────────────────────────

function IssuePassSheet({
  open,
  onOpenChange,
  templateId,
  passType,
  onIssued,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId: string
  passType: string
  onIssued: () => void
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const supportsHolderPhoto = HOLDER_PHOTO_PASS_TYPES.includes(passType)

  // ── Existing contact state ──
  const [selectedContacts, setSelectedContacts] = useState<DirectIssueContact[]>([])
  const [searchResults, setSearchResults] = useState<DirectIssueContact[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [results, setResults] = useState<IssueContactResult[] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── New contact state ──
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [holderPhotoFile, setHolderPhotoFile] = useState<File | null>(null)
  const [holderPhotoPreview, setHolderPhotoPreview] = useState<string | null>(null)
  const holderPhotoInputRef = useRef<HTMLInputElement>(null)
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null)

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (!value.trim()) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      debounceRef.current = setTimeout(async () => {
        const contacts = await searchContactsForIssue(value, templateId)
        const filtered = contacts.filter(
          (c) => !selectedContacts.some((s) => s.id === c.id)
        )
        setSearchResults(filtered)
        setIsSearching(false)
      }, 300)
    },
    [templateId, selectedContacts]
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleSelect(contact: DirectIssueContact) {
    setSelectedContacts((prev) => [...prev, contact])
    setSearchResults((prev) => prev.filter((c) => c.id !== contact.id))
    setSearchQuery("")
  }

  function handleRemove(contactId: string) {
    setSelectedContacts((prev) => prev.filter((c) => c.id !== contactId))
  }

  function handleIssueExisting() {
    if (selectedContacts.length === 0) return

    startTransition(async () => {
      const result = await issuePassToContacts(
        templateId,
        selectedContacts.map((c) => c.id)
      )

      if (!result.success) {
        toast.error(result.error ?? "Failed to issue passes")
        return
      }

      setResults(result.results)
      setSelectedContacts([])

      if (result.issuedCount > 0) {
        toast.success(
          `Issued ${result.issuedCount} pass${result.issuedCount !== 1 ? "es" : ""}${
            result.skippedCount > 0 ? ` (${result.skippedCount} already had a pass)` : ""
          }`
        )
        onIssued()
      } else if (result.skippedCount > 0) {
        toast.info("All selected contacts already have a pass for this program")
      }
    })
  }

  function handleCreateAndIssue() {
    if (!newName.trim()) {
      setFieldError({ field: "fullName", message: "Name is required" })
      return
    }
    setFieldError(null)

    startTransition(async () => {
      const result = await createContactAndIssuePass(
        templateId,
        newName,
        newEmail,
        newPhone
      )

      if (!result.success) {
        if (result.duplicateField) {
          setFieldError({ field: result.duplicateField, message: result.error ?? "Duplicate" })
        } else {
          toast.error(result.error ?? "Failed to create contact")
        }
        return
      }

      // Upload holder photo if provided
      if (holderPhotoFile && result.passInstanceId) {
        const fd = new FormData()
        fd.append("passInstanceId", result.passInstanceId)
        fd.append("file", holderPhotoFile)
        const photoResult = await uploadInstanceHolderPhoto(fd)
        if (photoResult.error) {
          toast.warning(`Pass issued but photo upload failed: ${photoResult.error}`)
        }
      }

      toast.success(`Pass issued to ${result.contactName}`)
      setNewName("")
      setNewEmail("")
      setNewPhone("")
      setHolderPhotoFile(null)
      setHolderPhotoPreview(null)
      onIssued()
    })
  }

  function handleClose(value: boolean) {
    if (!value) {
      setSelectedContacts([])
      setSearchResults([])
      setSearchQuery("")
      setResults(null)
      setNewName("")
      setNewEmail("")
      setNewPhone("")
      setHolderPhotoFile(null)
      setHolderPhotoPreview(null)
      setFieldError(null)
      setMode("existing")
    }
    onOpenChange(value)
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand/10">
              <Plus className="size-4 text-brand" />
            </div>
            <div>
              <SheetTitle className="text-base">Issue Pass</SheetTitle>
              <SheetDescription className="text-[13px]">
                Issue a pass to an existing or new contact.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4 px-4">
          {/* Mode toggle */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                mode === "existing"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Existing contact
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                mode === "new"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              New contact
            </button>
          </div>

          {mode === "existing" ? (
            <>
              {/* Contact picker */}
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    aria-label="Search contacts"
                    className="w-full justify-start h-9 text-[13px] font-normal text-muted-foreground"
                  >
                    <Search className="mr-2 size-3.5 shrink-0 opacity-50" />
                    Search by name, email, or phone...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search contacts..."
                      value={searchQuery}
                      onValueChange={handleSearch}
                      className="text-[13px]"
                    />
                    <CommandList>
                      {isSearching ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : searchQuery.trim() && searchResults.length === 0 ? (
                        <CommandEmpty className="text-[13px] py-4">
                          <p>No contacts found</p>
                          <button
                            type="button"
                            onClick={() => {
                              setMode("new")
                              setNewName(searchQuery)
                              setPopoverOpen(false)
                            }}
                            className="text-brand text-[12px] mt-1 hover:underline"
                          >
                            Create &ldquo;{searchQuery}&rdquo; as new contact
                          </button>
                        </CommandEmpty>
                      ) : searchResults.length > 0 ? (
                        <CommandGroup>
                          {searchResults.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              value={contact.id}
                              onSelect={() => {
                                handleSelect(contact)
                                setPopoverOpen(false)
                              }}
                              className="text-[13px]"
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{contact.fullName}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {contact.email ?? contact.phone ?? "No contact info"}
                                </span>
                              </div>
                              {!contact.email && (
                                <Badge
                                  variant="outline"
                                  className="ml-auto text-[10px] px-1.5 py-0"
                                >
                                  No email
                                </Badge>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ) : null}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Selected contacts */}
              {selectedContacts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedContacts.map((contact) => (
                    <Badge
                      key={contact.id}
                      variant="secondary"
                      className="gap-1 text-[12px] pr-1"
                    >
                      {contact.fullName}
                      {!contact.email && (
                        <MailX className="size-2.5 text-muted-foreground" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemove(contact.id)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                        aria-label={`Remove ${contact.fullName}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleClose(false)}
                  className="text-[13px]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={selectedContacts.length === 0 || isPending}
                  onClick={handleIssueExisting}
                  className="gap-1.5 text-[13px]"
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  Issue {selectedContacts.length || ""} pass{selectedContacts.length !== 1 ? "es" : ""}
                </Button>
              </div>

              {/* Results */}
              {results && results.length > 0 && (
                <div className="space-y-1.5 border-t border-border pt-3">
                  <ul className="space-y-1">
                    {results.map((r) => (
                      <li
                        key={r.contactId}
                        className="flex items-center gap-2 text-[13px]"
                      >
                        {r.status === "issued" && <CheckCircle className="size-3.5 text-emerald-500 shrink-0" />}
                        {r.status === "no_email" && <Mail className="size-3.5 text-amber-500 shrink-0" />}
                        {r.status === "already_exists" && <XCircle className="size-3.5 text-muted-foreground shrink-0" />}
                        {r.status === "error" && <XCircle className="size-3.5 text-destructive shrink-0" />}
                        <span className="truncate">{r.contactName}</span>
                        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                          {r.status === "issued" && "Issued & emailed"}
                          {r.status === "no_email" && "Issued (no email)"}
                          {r.status === "already_exists" && "Already has pass"}
                          {r.status === "error" && (r.error ?? "Failed")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              {/* New contact form */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="issue-name" className="text-[13px]">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="issue-name"
                    value={newName}
                    onChange={(e) => { setNewName(e.target.value); setFieldError(null) }}
                    placeholder="John Doe"
                    className="h-9 text-[13px]"
                    autoFocus
                    aria-invalid={fieldError?.field === "fullName"}
                    aria-describedby={fieldError?.field === "fullName" ? "issue-name-error" : undefined}
                  />
                  {fieldError?.field === "fullName" && (
                    <p id="issue-name-error" className="flex items-center gap-1 text-[11px] text-destructive" role="alert">
                      <XCircle className="size-3" />
                      {fieldError.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="issue-email" className="text-[13px]">
                    Email
                  </Label>
                  <Input
                    id="issue-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => { setNewEmail(e.target.value); setFieldError(null) }}
                    placeholder="john@example.com"
                    className="h-9 text-[13px]"
                    aria-invalid={fieldError?.field === "email"}
                    aria-describedby={fieldError?.field === "email" ? "issue-email-error" : undefined}
                  />
                  {fieldError?.field === "email" && (
                    <p id="issue-email-error" className="flex items-center gap-1 text-[11px] text-destructive" role="alert">
                      <XCircle className="size-3" />
                      {fieldError.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="issue-phone" className="text-[13px]">
                    Phone
                  </Label>
                  <Input
                    id="issue-phone"
                    type="tel"
                    value={newPhone}
                    onChange={(e) => { setNewPhone(e.target.value); setFieldError(null) }}
                    placeholder="+1 (555) 123-4567"
                    className="h-9 text-[13px]"
                    aria-invalid={fieldError?.field === "phone"}
                    aria-describedby={fieldError?.field === "phone" ? "issue-phone-error" : undefined}
                  />
                  {fieldError?.field === "phone" && (
                    <p id="issue-phone-error" className="flex items-center gap-1 text-[11px] text-destructive" role="alert">
                      <XCircle className="size-3" />
                      {fieldError.message}
                    </p>
                  )}
                </div>

                {/* Holder photo upload for eligible types */}
                {supportsHolderPhoto && (
                  <div className="space-y-1.5">
                    <Label className="text-[13px]">Holder Photo</Label>
                    <input
                      ref={holderPhotoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error("File must be under 2MB")
                          return
                        }
                        setHolderPhotoFile(file)
                        const url = URL.createObjectURL(file)
                        setHolderPhotoPreview(url)
                      }}
                    />
                    <div
                      onClick={() => holderPhotoInputRef.current?.click()}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-dashed border-border cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <div className="size-10 rounded-full bg-muted border-2 border-border overflow-hidden flex items-center justify-center shrink-0">
                        {holderPhotoPreview ? (
                          <img
                            src={holderPhotoPreview}
                            alt="Holder photo preview"
                            className="size-full object-cover"
                          />
                        ) : (
                          <UserCircle className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium">
                          {holderPhotoFile ? holderPhotoFile.name : "Upload photo"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {holderPhotoFile ? "Click to replace" : "PNG, JPEG, or WebP · 2MB max"}
                        </p>
                      </div>
                      {holderPhotoFile && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setHolderPhotoFile(null)
                            if (holderPhotoPreview) URL.revokeObjectURL(holderPhotoPreview)
                            setHolderPhotoPreview(null)
                          }}
                          className="p-1 rounded-md hover:bg-muted-foreground/20 transition-colors"
                          aria-label="Remove photo"
                        >
                          <X className="size-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleClose(false)}
                  className="text-[13px]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!newName.trim() || isPending}
                  onClick={handleCreateAndIssue}
                  className="gap-1.5 text-[13px]"
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  Create & issue pass
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main component ────────────────────────────────────────────

export function PassInstancesView({
  result,
  stats,
  templateId,
  passType,
  templateConfig,
  search,
  status,
  page,
}: PassInstancesViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [issueSheetOpen, setIssueSheetOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<{
    id: string; fullName: string; email: string | null; phone: string | null
  } | null>(null)
  const totalPages = Math.ceil(result.total / result.perPage)
  const progressHeader = getProgressColumnHeader(passType)

  const buildUrl = useCallback(
    (overrides: Record<string, string | number>) => {
      const params = new URLSearchParams()
      const merged = { search, status, page, ...overrides }
      if (merged.search) params.set("search", String(merged.search))
      if (merged.status && merged.status !== "all")
        params.set("status", String(merged.status))
      if (Number(merged.page) > 1)
        params.set("page", String(merged.page))
      const qs = params.toString()
      return qs ? `${pathname}?${qs}` : pathname
    },
    [pathname, search, status, page]
  )

  const statusFilters = [
    { key: "all", label: "All", count: stats.total },
    { key: "ACTIVE", label: "Active", count: stats.active },
    { key: "COMPLETED", label: "Completed", count: stats.completed },
    { key: "SUSPENDED", label: "Suspended", count: stats.suspended },
    { key: "EXPIRED", label: "Expired", count: stats.expired },
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Passes" value={stats.total} icon={Users} />
        <StatCard label="Active" value={stats.active} icon={CheckCircle} />
        <StatCard label="Suspended" value={stats.suspended} icon={PauseCircle} />
        <StatCard label="In Wallet" value={stats.withWallet} icon={Wallet} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            defaultValue={search}
            onChange={(e) => {
              const val = e.target.value
              const timeout = setTimeout(() => {
                router.push(buildUrl({ search: val, page: 1 }))
              }, 300)
              return () => clearTimeout(timeout)
            }}
            className="pl-9 h-9"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setIssueSheetOpen(true)}
          className="gap-1.5 text-[13px] shrink-0"
        >
          <Plus className="size-3.5" />
          Issue pass
        </Button>
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() =>
                router.push(buildUrl({ status: f.key, page: 1 }))
              }
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                status === f.key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
              <span className="ml-1.5 text-[11px] opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {result.items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold">No passes found</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {search
              ? "No passes match your search."
              : "No passes have been issued for this program yet."}
          </p>
        </Card>
      ) : (
        <>
          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Contact
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell w-16">
                      #
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      {progressHeader}
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">
                      Wallet
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">
                      Issued
                    </th>
                    <th className="w-10 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((pi) => {
                    const pv = getProgressValue(passType, pi.data, templateConfig)
                    return (
                      <tr
                        key={pi.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-[13px]">
                              {pi.contact.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {pi.contact.email ?? pi.contact.phone ?? "—"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums hidden sm:table-cell">
                          {pi.contact.memberNumber}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px] px-1.5 py-0",
                              statusStyles[pi.status] ?? ""
                            )}
                          >
                            {pi.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium tabular-nums">
                              {pv.text}
                            </span>
                            {pv.progress !== undefined && (
                              <MiniProgressBar value={pv.progress} />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <WalletIcon provider={pi.walletProvider} />
                            <span className="text-xs">
                              {pi.walletProvider === "NONE"
                                ? "—"
                                : pi.walletProvider === "APPLE"
                                  ? "Apple"
                                  : "Google"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden sm:table-cell">
                          {formatDistanceToNow(new Date(pi.issuedAt), {
                            addSuffix: true,
                          })}
                        </td>
                        <td className="px-2 py-3">
                          <RowActions
                            passInstanceId={pi.id}
                            currentStatus={pi.status}
                            contactEmail={pi.contact.email}
                            passType={passType}
                            onStatusChange={() => router.refresh()}
                            onEditContact={() => setEditingContact(pi.contact)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {result.total} pass{result.total !== 1 ? "es" : ""} total
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() =>
                    router.push(buildUrl({ page: page - 1 }))
                  }
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages}
                  onClick={() =>
                    router.push(buildUrl({ page: page + 1 }))
                  }
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <IssuePassSheet
        open={issueSheetOpen}
        onOpenChange={setIssueSheetOpen}
        templateId={templateId}
        passType={passType}
        onIssued={() => router.refresh()}
      />

      {editingContact && (
        <EditContactSheet
          open={!!editingContact}
          onOpenChange={(open) => { if (!open) setEditingContact(null) }}
          contact={editingContact}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  )
}
