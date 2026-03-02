"use client"

import { useState } from "react"
import type { AdminRestaurantRow } from "@/server/admin-actions"
import { AdminRestaurantFilters } from "./admin-restaurant-filters"
import { AdminRestaurantTable } from "./admin-restaurant-table"
import { AdminRestaurantDetailSheet } from "./admin-restaurant-detail-sheet"

type AdminRestaurantsViewProps = {
  restaurants: AdminRestaurantRow[]
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

export function AdminRestaurantsView({
  restaurants,
  total,
  pageCount,
  params,
}: AdminRestaurantsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function handleSelect(id: string) {
    setSelectedId(id)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Restaurants</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage all restaurants on the platform.
        </p>
      </div>

      <AdminRestaurantFilters
        search={params.search}
        filter={params.filter}
        total={total}
      />

      <AdminRestaurantTable
        restaurants={restaurants}
        pageCount={pageCount}
        sort={params.sort}
        order={params.order}
        page={params.page}
        onSelectRestaurant={handleSelect}
      />

      <AdminRestaurantDetailSheet
        restaurantId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}
