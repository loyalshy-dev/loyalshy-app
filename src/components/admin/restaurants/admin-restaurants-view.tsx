"use client"

import { useState } from "react"
import type { AdminOrganizationRow } from "@/server/admin-actions"
import { AdminRestaurantFilters as AdminOrganizationFilters } from "./admin-restaurant-filters"
import { AdminOrganizationTable } from "./admin-restaurant-table"
import { AdminOrganizationDetailSheet } from "./admin-restaurant-detail-sheet"

type AdminOrganizationsViewProps = {
  organizations: AdminOrganizationRow[]
  total: number
  pageCount: number
  params: {
    search: string
    sort: string
    order: "asc" | "desc"
    page: number
    filter: "all" | "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED"
  }
}

export function AdminOrganizationsView({
  organizations,
  total,
  pageCount,
  params,
}: AdminOrganizationsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function handleSelect(id: string) {
    setSelectedId(id)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Organizations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage all organizations on the platform.
        </p>
      </div>

      <AdminOrganizationFilters
        search={params.search}
        filter={params.filter}
        total={total}
      />

      <AdminOrganizationTable
        organizations={organizations}
        pageCount={pageCount}
        sort={params.sort}
        order={params.order}
        page={params.page}
        onSelectOrganization={handleSelect}
      />

      <AdminOrganizationDetailSheet
        organizationId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}
