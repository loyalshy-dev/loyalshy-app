"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ContactTable } from "./contact-table"
import { ContactFilters } from "./contact-filters"
import { AddContactSheet } from "./add-contact-sheet"
import { ContactDetailSheet } from "./contact-detail-sheet"
import { ContactEmptyState } from "./contact-empty-state"
import { RegisterVisitDialog as RegisterInteractionDialog } from "@/components/dashboard/register-visit-dialog"
import type { ContactRow, ContactListResult } from "@/server/contact-actions"

type ContactsViewProps = {
  result: ContactListResult
  search: string
  sort: string
  order: "asc" | "desc"
  page: number
  hasReward: string
  templateType: string
  isEmpty: boolean
}

export function ContactsView({
  result,
  search,
  sort,
  order,
  page,
  hasReward,
  templateType,
  isEmpty,
}: ContactsViewProps) {
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [detailContactId, setDetailContactId] = useState<string | null>(null)
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [registerInteractionOpen, setRegisterInteractionOpen] = useState(false)
  const [registerInteractionContactId, setRegisterInteractionContactId] = useState<string | null>(null)
  const [registerInteractionContactName, setRegisterInteractionContactName] = useState<string | null>(null)

  function handleViewDetail(contact: ContactRow) {
    setDetailContactId(contact.id)
    setDetailSheetOpen(true)
  }

  function handleEdit(contact: ContactRow) {
    setDetailContactId(contact.id)
    setDetailSheetOpen(true)
  }

  function handleDelete(contact: ContactRow) {
    setDetailContactId(contact.id)
    setDetailSheetOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Manage your pass holders.
          </p>
        </div>
        {!isEmpty && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setAddSheetOpen(true)}
          >
            <UserPlus className="size-3.5" />
            <span className="hidden sm:inline">Add Contact</span>
          </Button>
        )}
      </div>

      {isEmpty ? (
        <ContactEmptyState onAddContact={() => setAddSheetOpen(true)} />
      ) : (
        <>
          {/* Filters */}
          <ContactFilters
            search={search}
            hasReward={hasReward}
            programType={templateType}
            totalResults={result.total}
          />

          {/* Table */}
          <ContactTable
            customers={result.contacts as Parameters<typeof ContactTable>[0]["customers"]}
            pageCount={result.pageCount}
            currentPage={page}
            total={result.total}
            sort={sort}
            order={order}
            onViewDetail={handleViewDetail}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </>
      )}

      {/* Add Contact Sheet */}
      <AddContactSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
      />

      {/* Contact Detail Sheet */}
      <ContactDetailSheet
        contactId={detailContactId}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open)
          if (!open) setDetailContactId(null)
        }}
        onContactDeleted={() => {
          setDetailContactId(null)
        }}
        onRegisterVisit={(contactId, contactName) => {
          setRegisterInteractionContactId(contactId)
          setRegisterInteractionContactName(contactName)
          setRegisterInteractionOpen(true)
        }}
      />

      {/* Register Interaction Dialog (from contact detail) */}
      <RegisterInteractionDialog
        open={registerInteractionOpen}
        onOpenChange={setRegisterInteractionOpen}
        preselectedCustomerId={registerInteractionContactId}
        preselectedCustomerName={registerInteractionContactName}
      />
    </div>
  )
}
