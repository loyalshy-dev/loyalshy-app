"use client"

import { useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { authClient } from "@/lib/auth-client"
import { adminImpersonateUser } from "@/server/admin-actions"
import type { AdminUserRow } from "@/server/admin-actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ROLE_LABELS: Record<string, string> = {
  USER: "user",
  ADMIN_SUPPORT: "adminSupport",
  ADMIN_BILLING: "adminBilling",
  ADMIN_OPS: "adminOps",
  SUPER_ADMIN: "superAdmin",
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  ADMIN_OPS: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  ADMIN_BILLING: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  ADMIN_SUPPORT: "bg-purple-500/10 text-purple-600 border-purple-500/20",
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

type AdminUserTableProps = {
  users: AdminUserRow[]
  pageCount: number
  sort: string
  order: "asc" | "desc"
  page: number
  onSelectUser: (userId: string) => void
}

export function AdminUserTable({
  users,
  pageCount,
  sort,
  order,
  page,
  onSelectUser,
}: AdminUserTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const t = useTranslations("admin.users")
  const tRoles = useTranslations("admin.roles")

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function handleSort(field: string) {
    const newOrder = sort === field && order === "desc" ? "asc" : "desc"
    updateParams({ sort: field, order: newOrder, page: null })
  }

  function handlePage(p: number) {
    updateParams({ page: p === 1 ? null : String(p) })
  }

  async function handleImpersonate(userId: string) {
    try {
      // Log impersonation server-side first
      const formData = new FormData()
      formData.set("userId", userId)
      await adminImpersonateUser(formData)

      // Then perform client-side impersonation via Better Auth
      await authClient.admin.impersonateUser({ userId })
      window.location.href = "/dashboard"
    } catch {
      toast.error(t("failedImpersonate"))
    }
  }

  const columns: ColumnDef<AdminUserRow>[] = [
    {
      accessorKey: "name",
      header: () => (
        <button
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => handleSort("name")}
        >
          {t("columnUser")}
          <ArrowUpDown className="size-3" />
        </button>
      ),
      cell: ({ row }) => {
        const u = row.original
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="size-7">
              <AvatarImage src={u.image ?? undefined} alt={u.name} />
              <AvatarFallback className="text-[10px]">
                {getInitials(u.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate">{u.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {u.email}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "role",
      header: t("columnRole"),
      cell: ({ row }) => {
        const role = row.original.role
        const roleKey = ROLE_LABELS[role] ?? "user"
        const colorClass = ROLE_COLORS[role] ?? "bg-muted text-muted-foreground"
        return (
          <Badge
            variant="outline"
            className={`text-[11px] ${colorClass}`}
          >
            {tRoles(roleKey)}
          </Badge>
        )
      },
    },
    {
      accessorKey: "banned",
      header: t("columnStatus"),
      cell: ({ row }) => {
        const banned = row.original.banned
        return (
          <Badge
            variant="outline"
            className={`text-[11px] ${
              banned
                ? "bg-destructive/10 text-destructive border-destructive/20"
                : "bg-success/10 text-success border-success/20"
            }`}
          >
            {banned ? "Banned" : "Active"}
          </Badge>
        )
      },
    },
    {
      accessorKey: "organizationName",
      header: t("columnOrganization"),
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">
          {row.original.organizationName ?? "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <button
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => handleSort("createdAt")}
        >
          {t("columnCreated")}
          <ArrowUpDown className="size-3" />
        </button>
      ),
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">
          {formatDistanceToNow(new Date(row.original.createdAt), {
            addSuffix: true,
          })}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const u = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="User actions"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onSelectUser(u.id)}>
                <Eye className="size-4" />
                {t("viewDetails")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleImpersonate(u.id)}>
                <UserCog className="size-4" />
                {t("impersonate")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {u.banned ? (
                <DropdownMenuItem onClick={() => onSelectUser(u.id)}>
                  <ShieldCheck className="size-4" />
                  {t("unbanUser")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => onSelectUser(u.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <ShieldAlert className="size-4" />
                  {t("banUser")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount,
    state: {
      sorting: [{ id: sort, desc: order === "desc" }],
      pagination: { pageIndex: page - 1, pageSize: 25 },
    },
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground h-9">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {t("noUsersFound")}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => onSelectUser(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("pageOf", { page, pageCount })}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page <= 1}
              onClick={() => handlePage(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={page >= pageCount}
              onClick={() => handlePage(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
