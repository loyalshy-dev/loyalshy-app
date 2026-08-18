"use client"

import { useState, useTransition } from "react"
import { format } from "date-fns"
import { FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import {
  getPartnerStatement,
  type PartnerRow,
  type PartnerStatement,
} from "@/server/partner-statement-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" })

function money(cents: number) {
  return eur.format(cents / 100)
}

function previousMonthValue(): string {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`
}

type PartnerStatementsViewProps = {
  partners: PartnerRow[]
}

export function PartnerStatementsView({ partners }: PartnerStatementsViewProps) {
  const t = useTranslations("admin.partners")
  const [partnerId, setPartnerId] = useState<string>(partners[0]?.id ?? "")
  const [monthValue, setMonthValue] = useState<string>(previousMonthValue)
  const [statement, setStatement] = useState<PartnerStatement | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    const [y, m] = monthValue.split("-").map(Number)
    if (!partnerId || !y || !m) return

    startTransition(async () => {
      const result = await getPartnerStatement(partnerId, y, m)
      if ("error" in result) {
        toast.error(t("generateError"))
        return
      }
      setStatement(result)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {partners.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("noPartners")}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>{t("partnerLabel")}</Label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={t("partnerLabel")} />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.attributedOrgCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="statement-month">{t("monthLabel")}</Label>
              <Input
                id="statement-month"
                type="month"
                value={monthValue}
                onChange={(e) => setMonthValue(e.target.value)}
                className="w-44"
              />
            </div>
            <Button onClick={handleGenerate} disabled={isPending || !partnerId}>
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileText className="size-3.5" />
              )}
              {t("generate")}
            </Button>
          </div>

          {statement && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {t("netCollected")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-semibold">
                      {money(statement.totals.netCollectedCents)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("grossMinusRefunds", {
                        gross: money(statement.totals.grossCollectedCents),
                        refunds: money(statement.totals.refundedCents),
                      })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {t("revShare", { rate: Math.round(statement.revShareRate * 100) })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-semibold">
                      {money(statement.totals.revShareCents)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {t("setupFeeShare")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-semibold">
                      &minus;{money(statement.totals.setupFeeShareCents)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("newActivated", { count: statement.totals.newActivatedCount })}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {statement.totals.payoutCents >= 0
                        ? t("payoutToPartner")
                        : t("payoutFromPartner")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-semibold">
                      {money(Math.abs(statement.totals.payoutCents))}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Lines */}
              <Card>
                <CardContent className="pt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("colOrganization")}</TableHead>
                        <TableHead>{t("colPlan")}</TableHead>
                        <TableHead>{t("colStatus")}</TableHead>
                        <TableHead>{t("colCreated")}</TableHead>
                        <TableHead className="text-right">{t("colGross")}</TableHead>
                        <TableHead className="text-right">{t("colRefunds")}</TableHead>
                        <TableHead className="text-right">{t("colNet")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statement.lines.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground py-6"
                          >
                            {t("noOrgs")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        statement.lines.map((line) => (
                          <TableRow key={line.organizationId}>
                            <TableCell className="font-medium">
                              {line.name}
                              {line.activatedThisMonth && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-[10px] bg-teal-500/10 text-teal-600 border-teal-500/20"
                                >
                                  {t("newBadge")}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{line.plan}</TableCell>
                            <TableCell>{line.subscriptionStatus}</TableCell>
                            <TableCell>
                              {format(new Date(line.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {money(line.grossCollectedCents)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.refundedCents > 0
                                ? `−${money(line.refundedCents)}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {money(line.netCents)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground">{t("methodology")}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
