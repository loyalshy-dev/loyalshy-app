"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import type { PartnerClient } from "@/server/partner-console-actions"
import { requestClientAccess } from "@/server/partner-console-actions"
import { NewClientDialog } from "@/components/dashboard/partner-tools"
import { switchActiveOrganization } from "@/server/org-switch-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type PartnerConsoleViewProps = {
  clients: PartnerClient[]
  referralUrl: string | null
}

export function PartnerConsoleView({ clients, referralUrl }: PartnerConsoleViewProps) {
  const t = useTranslations("dashboard.partnerConsole")
  const [copied, setCopied] = useState(false)
  const [openingOrgId, setOpeningOrgId] = useState<string | null>(null)
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [requestingOrgId, setRequestingOrgId] = useState<string | null>(null)
  const [requestedOrgIds, setRequestedOrgIds] = useState<Set<string>>(new Set())

  async function handleRequestAccess(organizationId: string) {
    if (requestingOrgId) return
    setRequestingOrgId(organizationId)
    const result = await requestClientAccess(organizationId)
    if ("error" in result) {
      toast.error(
        result.error === "rate_limited" ? t("requestAccessRateLimited") : t("requestAccessError")
      )
    } else {
      toast.success(t("requestAccessSent"))
      setRequestedOrgIds((prev) => new Set(prev).add(organizationId))
    }
    setRequestingOrgId(null)
  }

  const subscribedCount = clients.filter(
    (c) => c.subscriptionStatus === "ACTIVE" || c.subscriptionStatus === "TRIALING"
  ).length
  const pendingHandoffs = clients.filter((c) => c.handoffPending).length

  async function handleCopyReferral() {
    if (!referralUrl) return
    try {
      await navigator.clipboard.writeText(referralUrl)
      setCopied(true)
      toast.success(t("copied"))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("copyFailed"))
    }
  }

  async function handleOpen(organizationId: string) {
    if (openingOrgId) return
    setOpeningOrgId(organizationId)
    const result = await switchActiveOrganization({ organizationId })
    if ("error" in result) {
      toast.error(t("openError"))
      setOpeningOrgId(null)
      return
    }
    window.location.assign("/dashboard")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setNewClientOpen(true)}>
          <Plus className="size-3.5" />
          {t("newClient")}
        </Button>
      </div>
      <NewClientDialog open={newClientOpen} onOpenChange={setNewClientOpen} />

      {/* Stats + referral link */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("statClients")} value={String(clients.length)} />
        <StatCard label={t("statSubscribed")} value={String(subscribedCount)} />
        <StatCard label={t("statPendingHandoffs")} value={String(pendingHandoffs)} />
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {t("referralCardTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {referralUrl ? (
              <div className="flex items-center gap-2">
                <Input value={referralUrl} readOnly className="font-mono text-xs h-8" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={handleCopyReferral}
                  aria-label={t("copyLink")}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clients */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("clientsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colClient")}</TableHead>
                <TableHead>{t("colPlan")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead>{t("colCreated")}</TableHead>
                <TableHead>{t("colSetup")}</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("noClients")}
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => (
                  <TableRow key={client.organizationId}>
                    <TableCell className="font-medium">
                      {client.name}
                      {client.handoffPending && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20"
                        >
                          <Link2 className="size-3 mr-0.5" />
                          {t("handoffPendingBadge")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{client.plan}</TableCell>
                    <TableCell>{client.subscriptionStatus}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(client.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ChecklistIcon
                          done={client.checklist.programPublished}
                          label={t("setupProgram")}
                        />
                        <ChecklistIcon
                          done={client.checklist.contactsJoined}
                          label={t("setupContacts")}
                        />
                        <ChecklistIcon
                          done={client.checklist.ownerClaimed}
                          label={t("setupOwner")}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {client.isMember ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={openingOrgId !== null}
                          onClick={() => handleOpen(client.organizationId)}
                        >
                          {openingOrgId === client.organizationId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <ArrowUpRight className="size-3.5" />
                          )}
                          {t("open")}
                        </Button>
                      ) : requestedOrgIds.has(client.organizationId) ? (
                        <span className="text-xs text-muted-foreground">
                          {t("requestAccessPending")}
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={requestingOrgId !== null}
                          onClick={() => handleRequestAccess(client.organizationId)}
                        >
                          {requestingOrgId === client.organizationId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <KeyRound className="size-3.5" />
                          )}
                          {t("requestAccess")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string
  value: string
  hint?: string
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? "border-primary/30" : undefined}>
      <CardHeader className="pb-1">
        <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function ChecklistIcon({ done, label }: { done: boolean; label: string }) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <span aria-label={`${label}: ${done ? "✓" : "✗"}`}>
          {done ? (
            <CheckCircle2 className="size-4 text-success" />
          ) : (
            <XCircle className="size-4 text-muted-foreground/40" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}
