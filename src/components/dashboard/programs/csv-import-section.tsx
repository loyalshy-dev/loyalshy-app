"use client"

import { useState, useTransition, useRef } from "react"
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Check,
  AlertCircle,
  X,
  Mail,
  SkipForward,
  Download,
} from "lucide-react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  bulkImportAndIssue,
  type BulkImportRow,
  type IssueContactResult,
} from "@/server/distribution-actions"
import { useTranslations } from "next-intl"

// ─── Constants ──────────────────────────────────────────────

const MAX_ROWS = 500
const MAX_FILE_SIZE = 1_000_000 // 1 MB

// ─── Props ──────────────────────────────────────────────────

type CsvImportSectionProps = {
  templateId: string
  templateName: string
}

// ─── CSV Parser ─────────────────────────────────────────────

function parseCsvText(text: string): { rows: BulkImportRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { rows: [], errors: ["File is empty"] }

  const headerLine = lines[0].toLowerCase()
  const hasHeader =
    headerLine.includes("name") ||
    headerLine.includes("email") ||
    headerLine.includes("phone")

  const dataLines = hasHeader ? lines.slice(1) : lines

  let nameIdx = 0
  let emailIdx = 1
  let phoneIdx = 2

  if (hasHeader) {
    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())
    nameIdx = headers.findIndex((h) =>
      h.includes("name") || h.includes("full_name") || h.includes("fullname")
    )
    emailIdx = headers.findIndex((h) => h.includes("email") || h.includes("e-mail"))
    phoneIdx = headers.findIndex((h) =>
      h.includes("phone") || h.includes("mobile") || h.includes("tel")
    )

    if (nameIdx === -1) {
      return { rows: [], errors: ["CSV must have a 'name' column"] }
    }
  }

  const rows: BulkImportRow[] = []
  const errors: string[] = []

  const linesToProcess = dataLines.slice(0, MAX_ROWS)

  if (dataLines.length > MAX_ROWS) {
    errors.push(`File has ${dataLines.length} rows — only the first ${MAX_ROWS} will be imported`)
  }

  for (let i = 0; i < linesToProcess.length; i++) {
    const cols = parseCSVLine(linesToProcess[i])
    const fullName = cols[nameIdx]?.trim() ?? ""

    if (!fullName) {
      errors.push(`Row ${i + 1}: Missing name`)
      continue
    }

    const email = emailIdx >= 0 ? cols[emailIdx]?.trim() ?? "" : ""
    const phone = phoneIdx >= 0 ? cols[phoneIdx]?.trim() ?? "" : ""

    rows.push({ fullName, email: email || undefined, phone: phone || undefined })
  }

  return { rows, errors }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

// ─── Component ──────────────────────────────────────────────

export function CsvImportSection({
  templateId,
  templateName,
}: CsvImportSectionProps) {
  const t = useTranslations("dashboard.distribution")
  const [parsedRows, setParsedRows] = useState<BulkImportRow[] | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [results, setResults] = useState<IssueContactResult[] | null>(null)
  const [summary, setSummary] = useState<{
    created: number
    issued: number
    skipped: number
    errors: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function downloadTemplate() {
    const csv = "name,email,phone\n"
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.download = "contacts-template.csv"
    link.href = url
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setResults(null)
    setSummary(null)

    if (!file.name.endsWith(".csv") && !file.type.includes("csv") && !file.type.includes("text")) {
      toast.error("Please upload a CSV file")
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large (max 1 MB)")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const { rows, errors } = parseCsvText(text)
      setParsedRows(rows)
      setParseErrors(errors)
      setFileName(file.name)
    }
    reader.readAsText(file)
  }

  function handleClear() {
    setParsedRows(null)
    setParseErrors([])
    setFileName(null)
    setResults(null)
    setSummary(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleImport() {
    if (!parsedRows || parsedRows.length === 0) return

    startTransition(async () => {
      const result = await bulkImportAndIssue(templateId, parsedRows)

      if (!result.success) {
        toast.error(result.error ?? t("importFailed"))
        return
      }

      setResults(result.results)
      setSummary({
        created: result.createdCount,
        issued: result.issuedCount,
        skipped: result.skippedCount,
        errors: result.errorCount,
      })
      setParsedRows(null)
      setFileName(null)
      if (fileInputRef.current) fileInputRef.current.value = ""

      if (result.issuedCount > 0) {
        toast.success(t("imported", { count: result.issuedCount }))
      }
    })
  }

  return (
    <Card className="p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="flex size-7 items-center justify-center rounded-md bg-brand/10">
            <Upload className="size-3.5 text-brand" />
          </div>
          <h3 className="text-sm font-medium">{t("bulkImport")}</h3>
        </div>
        <p className="text-[13px] text-muted-foreground ml-9">
          {t("bulkImportDescription")}
        </p>
      </div>

      {/* Template download + file input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 ml-9">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[12px] h-7"
            onClick={downloadTemplate}
          >
            <Download className="size-3" />
            Download CSV template
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Columns: name, email, phone
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="hidden"
          id="csv-upload"
        />

        {!parsedRows ? (
          <label
            htmlFor="csv-upload"
            className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-brand/50 hover:bg-muted/30 transition-colors"
          >
            <FileSpreadsheet className="size-5 text-muted-foreground" />
            <span className="text-[13px] text-muted-foreground">
              {t("uploadCsv")}
            </span>
          </label>
        ) : (
          <div className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-brand" />
                <span className="text-[13px] font-medium">{fileName}</span>
                <Badge variant="secondary" className="text-[11px]">
                  {parsedRows.length} row{parsedRows.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded hover:bg-muted transition-colors"
                aria-label="Clear file"
              >
                <X className="size-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Preview first 5 rows */}
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1 pr-3 text-muted-foreground font-medium">Name</th>
                    <th className="text-left py-1 pr-3 text-muted-foreground font-medium">Email</th>
                    <th className="text-left py-1 text-muted-foreground font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-1 pr-3">{row.fullName}</td>
                      <td className="py-1 pr-3 text-muted-foreground">{row.email || "—"}</td>
                      <td className="py-1 text-muted-foreground">{row.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 5 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  ...and {parsedRows.length - 5} more
                </p>
              )}
            </div>

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div className="space-y-1">
                {parseErrors.slice(0, 3).map((err, i) => (
                  <p key={i} className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                    <AlertCircle className="size-3 shrink-0" />
                    {err}
                  </p>
                ))}
                {parseErrors.length > 3 && (
                  <p className="text-[11px] text-muted-foreground">
                    ...and {parseErrors.length - 3} more warnings
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import button */}
      {parsedRows && parsedRows.length > 0 && (
        <Button
          size="sm"
          disabled={isPending}
          onClick={handleImport}
          className="gap-1.5 text-[13px]"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          Import & issue {parsedRows.length} pass{parsedRows.length !== 1 ? "es" : ""}
        </Button>
      )}

      {/* Summary */}
      {summary && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {summary.created > 0 && (
            <Badge variant="secondary" className="text-[11px]">
              {summary.created} new contact{summary.created !== 1 ? "s" : ""}
            </Badge>
          )}
          {summary.issued > 0 && (
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0 text-[11px]">
              {summary.issued} issued
            </Badge>
          )}
          {summary.skipped > 0 && (
            <Badge variant="outline" className="text-[11px]">
              {summary.skipped} skipped
            </Badge>
          )}
          {summary.errors > 0 && (
            <Badge variant="destructive" className="text-[11px]">
              {summary.errors} error{summary.errors !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}

      {/* Results list */}
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
            onClick={() => {
              setResults(null)
              setSummary(null)
            }}
          >
            Dismiss
          </Button>
        </div>
      )}
    </Card>
  )
}
