"use client"

import { useState } from "react"
import type { AdminUserRow } from "@/server/admin-actions"
import { AdminUserFilters } from "./admin-user-filters"
import { AdminUserTable } from "./admin-user-table"
import { AdminUserDetailSheet } from "./admin-user-detail-sheet"

type AdminUsersViewProps = {
  users: AdminUserRow[]
  total: number
  pageCount: number
  params: {
    search: string
    sort: string
    order: "asc" | "desc"
    page: number
    filter: "all" | "banned" | "super_admin" | "admins"
  }
}

export function AdminUsersView({
  users,
  total,
  pageCount,
  params,
}: AdminUsersViewProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function handleSelectUser(userId: string) {
    setSelectedUserId(userId)
    setSheetOpen(true)
  }

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage all platform users.
        </p>
      </div>

      <AdminUserFilters
        search={params.search}
        filter={params.filter}
        total={total}
      />

      <AdminUserTable
        users={users}
        pageCount={pageCount}
        sort={params.sort}
        order={params.order}
        page={params.page}
        onSelectUser={handleSelectUser}
      />

      <AdminUserDetailSheet
        user={selectedUser}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}
