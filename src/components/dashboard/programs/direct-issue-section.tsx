"use client"

import { useState, useTransition, useCallback, useRef, useEffect } from "react"
import {
  Send,
  Search,
  Loader2,
  Check,
  AlertCircle,
  X,
  Mail,
  MailX,
  SkipForward,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  searchContactsForIssue,
  issuePassToContacts,
  issuePassToAllEligible,
  type DirectIssueContact,
  type IssueContactResult,
} from "@/server/distribution-actions"

// ─── Props ──────────────────────────────────────────────────

type DirectIssueSectionProps = {
  templateId: string
  templateName: string
  passType: string
  eligibleCount: number
}

// ─── Component ──────────────────────────────────────────────

export function DirectIssueSection({
  templateId,
  templateName,
  passType,
  eligibleCount: initialEligibleCount,
}: DirectIssueSectionProps) {
  const [selectedContacts, setSelectedContacts] = useState<DirectIssueContact[]>([])
  const [searchResults, setSearchResults] = useState<DirectIssueContact[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isBulkPending, startBulkTransition] = useTransition()
  const [results, setResults] = useState<IssueContactResult[] | null>(null)
  const [eligibleCount, setEligibleCount] = useState(initialEligibleCount)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search
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

  function handleIssue() {
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
      setEligibleCount((prev) => Math.max(0, prev - result.issuedCount))

      if (result.issuedCount > 0) {
        toast.success(
          `Issued ${result.issuedCount} pass${result.issuedCount !== 1 ? "es" : ""}${
            result.skippedCount > 0
              ? ` (${result.skippedCount} already had a pass)`
              : ""
          }`
        )
      } else if (result.skippedCount > 0) {
        toast.info("All selected contacts already have a pass for this program")
      }
    })
  }

  function handleBulkIssue() {
    startBulkTransition(async () => {
      const result = await issuePassToAllEligible(templateId)

      if (!result.success) {
        toast.error(result.error ?? "Failed to issue passes")
        return
      }

      setResults(result.results)
      setEligibleCount((prev) => Math.max(0, prev - result.issuedCount))

      if (result.issuedCount > 0) {
        toast.success(
          `Issued ${result.issuedCount} pass${result.issuedCount !== 1 ? "es" : ""} to all eligible contacts`
        )
      } else {
        toast.info("No eligible contacts found")
      }
    })
  }

  return (
    <Card className="p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex size-7 items-center justify-center rounded-md bg-brand/10">
            <Send className="size-3.5 text-brand" />
          </div>
          <h3 className="text-sm font-medium">Issue directly to contacts</h3>
        </div>
        <p className="text-[13px] text-muted-foreground ml-9">
          Select existing contacts to create and deliver a pass for{" "}
          <span className="font-medium text-foreground">{templateName}</span>.
          Contacts with an email will receive a notification.
        </p>
      </div>

      {/* Contact picker */}
      <div className="space-y-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-label="Search contacts"
              className="w-full justify-start h-9 text-[13px] font-normal text-muted-foreground"
            >
              <Search className="mr-2 size-3.5 shrink-0 opacity-50" />
              Search contacts by name, email, or phone...
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
                  <CommandEmpty className="text-[13px]">
                    No contacts found
                  </CommandEmpty>
                ) : searchResults.length > 0 ? (
                  <CommandGroup>
                    {searchResults.map((contact) => (
                      <CommandItem
                        key={contact.id}
                        value={contact.id}
                        onSelect={() => {
                          handleSelect(contact)
                          setOpen(false)
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

        {/* Selected contacts chips */}
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
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          disabled={selectedContacts.length === 0 || isPending}
          onClick={handleIssue}
          className="gap-1.5 text-[13px]"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          Issue pass to {selectedContacts.length || ""}{" "}
          contact{selectedContacts.length !== 1 ? "s" : ""}
        </Button>

        {/* Bulk issue all eligible */}
        {eligibleCount > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isBulkPending}
                className="gap-1.5 text-[13px]"
              >
                {isBulkPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Users className="size-3.5" />
                )}
                Issue to all eligible ({eligibleCount > 100 ? "100+" : eligibleCount})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Issue passes to all eligible contacts?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create and deliver a pass for <strong>{templateName}</strong> to
                  {eligibleCount > 100
                    ? " the first 100 eligible contacts (out of " + eligibleCount + " total)."
                    : ` ${eligibleCount} contact${eligibleCount !== 1 ? "s" : ""}.`
                  }
                  {" "}Contacts with an email address will receive a notification.
                  {eligibleCount > 100 && (
                    <span className="block mt-2 text-[13px]">
                      Run this action again to issue passes to the next batch.
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkIssue}>
                  Issue passes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Results feedback */}
      {results && results.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
            Results
          </p>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {results.map((r, i) => (
              <li
                key={`${r.contactId}-${i}`}
                className="flex items-center gap-2 text-[13px]"
              >
                {r.status === "issued" && (
                  <Check className="size-3.5 text-emerald-500 shrink-0" />
                )}
                {r.status === "no_email" && (
                  <Mail className="size-3.5 text-amber-500 shrink-0" />
                )}
                {r.status === "already_exists" && (
                  <SkipForward className="size-3.5 text-muted-foreground shrink-0" />
                )}
                {r.status === "error" && (
                  <AlertCircle className="size-3.5 text-destructive shrink-0" />
                )}
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
          <Button
            variant="ghost"
            size="sm"
            className="text-[12px] h-7 px-2"
            onClick={() => setResults(null)}
          >
            Dismiss
          </Button>
        </div>
      )}
    </Card>
  )
}
