"use client"

import { useTransition, useRef } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table"
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Shield,
} from "lucide-react"
import { useTranslations } from "next-intl"
import type { AdminAuditLogRow } from "@/server/admin-actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const ACTION_LABELS: Record<string, string> = {
  USER_BANNED: "actionUserBanned",
  USER_UNBANNED: "actionUserUnbanned",
  USER_ROLE_CHANGED: "actionUserRoleChanged",
  USER_SESSIONS_REVOKED: "actionUserSessionsRevoked",
  USER_IMPERSONATED: "actionUserImpersonated",
  USER_IMPERSONATION_ENDED: "actionUserImpersonationEnded",
  USER_DATA_EXPORTED: "actionUserDataExported",
  USER_DELETED: "actionUserDeleted",
  ORG_PLAN_CHANGED: "actionOrgPlanChanged",
  ORG_STATUS_CHANGED: "actionOrgStatusChanged",
  ORG_DELETED: "actionOrgDeleted",
  CONTACTS_PURGED: "actionContactsPurged",
  BULK_BAN: "actionBulkBan",
  BULK_STATUS_CHANGE: "actionBulkStatusChange",
  BULK_EXPORT: "actionBulkExport",
}

const ACTION_COLORS: Record<string, string> = {
  USER_BANNED: "bg-destructive/10 text-destructive border-destructive/20",
  USER_UNBANNED: "bg-success/10 text-success border-success/20",
  USER_ROLE_CHANGED: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  USER_SESSIONS_REVOKED: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  USER_IMPERSONATED: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  USER_IMPERSONATION_ENDED: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  USER_DATA_EXPORTED: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  USER_DELETED: "bg-destructive/10 text-destructive border-destructive/20",
  ORG_PLAN_CHANGED: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  ORG_STATUS_CHANGED: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  ORG_DELETED: "bg-destructive/10 text-destructive border-destructive/20",
  CONTACTS_PURGED: "bg-destructive/10 text-destructive border-destructive/20",
  BULK_BAN: "bg-destructive/10 text-destructive border-destructive/20",
  BULK_STATUS_CHANGE: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  BULK_EXPORT: "bg-blue-500/10 text-blue-600 border-blue-500/20",
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  user: "targetUser",
  organization: "targetOrganization",
  contact: "targetContact",
}

type AdminAuditLogViewProps = {
  logs: AdminAuditLogRow[]
  total: number
  pageCount: number
  page: number
  search: string
  action: string
  targetType: string
}

export function AdminAuditLogView({
  logs,
  total,
  pageCount,
  page,
  search,
  action,
  targetType,
}: AdminAuditLogViewProps) {
  const t = useTranslations("admin.auditLog")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    // Reset page on filter change
    if (!("page" in updates)) params.delete("page")
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParams({ search: value || null })
    }, 300)
  }

  function handlePage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (p === 1) {
      params.delete("page")
    } else {
      params.set("page", String(p))
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const columns: ColumnDef<AdminAuditLogRow>[] = [
    {
      accessorKey: "admin",
      header: t("columnAdmin"),
      cell: ({ row }) => {
        const admin = row.original.admin
        return (
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarImage src={admin.image ?? undefined} alt={admin.name} />
              <AvatarFallback className="text-[9px]">
                {getInitials(admin.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-[13px] truncate max-w-[120px]">{admin.name}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "action",
      header: t("columnAction"),
      cell: ({ row }) => {
        const actionKey = ACTION_LABELS[row.original.action] ?? row.original.action
        const colorClass = ACTION_COLORS[row.original.action] ?? "bg-muted text-muted-foreground"
        return (
          <Badge variant="outline" className={`text-[11px] ${colorClass}`}>
            {t(actionKey)}
          </Badge>
        )
      },
    },
    {
      accessorKey: "targetType",
      header: t("columnTarget"),
      cell: ({ row }) => {
        const typeKey = TARGET_TYPE_LABELS[row.original.targetType] ?? row.original.targetType
        return (
          <div className="space-y-0.5">
            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
              {t(typeKey)}
            </Badge>
            {row.original.targetLabel && (
              <p className="text-[12px] text-muted-foreground truncate max-w-[160px]">
                {row.original.targetLabel}
              </p>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "reason",
      header: t("columnReason"),
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground truncate max-w-[200px] block">
          {row.original.reason ?? "\u2014"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("columnDate"),
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(row.original.createdAt), {
            addSuffix: true,
          })}
        </span>
      ),
    },
  ]

  const table = useReactTable({
    data: logs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
    state: {
      pagination: { pageIndex: page - 1, pageSize: 25 },
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Shield className="size-4 text-amber-500" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "entry" : "entries"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            defaultValue={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-8 h-8 text-[13px]"
          />
        </div>
        <Select
          value={action}
          onValueChange={(v) => updateParams({ action: v })}
        >
          <SelectTrigger className="w-[180px] h-8 text-[13px]">
            <SelectValue placeholder={t("filterAllActions")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterAllActions")}</SelectItem>
            {Object.keys(ACTION_LABELS).map((key) => (
              <SelectItem key={key} value={key}>
                {t(ACTION_LABELS[key])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={targetType}
          onValueChange={(v) => updateParams({ targetType: v })}
        >
          <SelectTrigger className="w-[150px] h-8 text-[13px]">
            <SelectValue placeholder={t("filterAllTypes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterAllTypes")}</SelectItem>
            <SelectItem value="user">{t("targetUser")}</SelectItem>
            <SelectItem value="organization">{t("targetOrganization")}</SelectItem>
            <SelectItem value="contact">{t("targetContact")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
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
                  {t("noLogsFound")}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
