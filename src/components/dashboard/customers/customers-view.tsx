"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CustomerTable } from "./customer-table"
import { CustomerFilters } from "./customer-filters"
import { AddCustomerSheet } from "./add-customer-sheet"
import { CustomerDetailSheet } from "./customer-detail-sheet"
import { CustomerEmptyState } from "./customer-empty-state"
import { RegisterVisitDialog } from "@/components/dashboard/register-visit-dialog"
import type { CustomerRow, CustomerListResult } from "@/server/customer-actions"

type CustomersViewProps = {
  result: CustomerListResult
  search: string
  sort: string
  order: "asc" | "desc"
  page: number
  hasReward: string
  isEmpty: boolean
}

export function CustomersView({
  result,
  search,
  sort,
  order,
  page,
  hasReward,
  isEmpty,
}: CustomersViewProps) {
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null)
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)
  const [registerVisitOpen, setRegisterVisitOpen] = useState(false)
  const [registerVisitCustomerId, setRegisterVisitCustomerId] = useState<string | null>(null)
  const [registerVisitCustomerName, setRegisterVisitCustomerName] = useState<string | null>(null)

  function handleViewDetail(customer: CustomerRow) {
    setDetailCustomerId(customer.id)
    setDetailSheetOpen(true)
  }

  function handleEdit(customer: CustomerRow) {
    setDetailCustomerId(customer.id)
    setDetailSheetOpen(true)
  }

  function handleDelete(customer: CustomerRow) {
    setDetailCustomerId(customer.id)
    setDetailSheetOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Manage your loyalty program members.
          </p>
        </div>
        {!isEmpty && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setAddSheetOpen(true)}
          >
            <UserPlus className="size-3.5" />
            <span className="hidden sm:inline">Add Customer</span>
          </Button>
        )}
      </div>

      {isEmpty ? (
        <CustomerEmptyState onAddCustomer={() => setAddSheetOpen(true)} />
      ) : (
        <>
          {/* Filters */}
          <CustomerFilters
            search={search}
            hasReward={hasReward}
            totalResults={result.total}
          />

          {/* Table */}
          <CustomerTable
            customers={result.customers}
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

      {/* Add Customer Sheet */}
      <AddCustomerSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
      />

      {/* Customer Detail Sheet */}
      <CustomerDetailSheet
        customerId={detailCustomerId}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open)
          if (!open) setDetailCustomerId(null)
        }}
        onCustomerDeleted={() => {
          setDetailCustomerId(null)
        }}
        onRegisterVisit={(customerId, customerName) => {
          setRegisterVisitCustomerId(customerId)
          setRegisterVisitCustomerName(customerName)
          setRegisterVisitOpen(true)
        }}
      />

      {/* Register Visit Dialog (from customer detail) */}
      <RegisterVisitDialog
        open={registerVisitOpen}
        onOpenChange={setRegisterVisitOpen}
        preselectedCustomerId={registerVisitCustomerId}
        preselectedCustomerName={registerVisitCustomerName}
      />
    </div>
  )
}
