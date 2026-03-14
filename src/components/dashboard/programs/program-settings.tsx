"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Loader2,
  Play,
  Trash2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  archivePassTemplate,
  activateTemplate as activateProgram,
  reactivateTemplate as reactivateProgram,
  deleteTemplate as deleteProgram,
} from "@/server/org-settings-actions"
import type { TemplateDeleteCounts } from "@/server/org-settings-actions"
import { PASS_TYPE_META, type PassType } from "@/types/pass-types"
import { Card } from "@/components/ui/card"
import { useTranslations } from "next-intl"

type ProgramSettingsProps = {
  program: {
    id: string
    name: string
    passType: string
    status: string
  }
  organizationId: string
}

export function ProgramSettings({ program, organizationId }: ProgramSettingsProps) {
  const t = useTranslations("dashboard.programSettings")
  const router = useRouter()
  const [isDangerPending, startDangerTransition] = useTransition()

  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [showReactivateDialog, setShowReactivateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleteCounts, setDeleteCounts] = useState<TemplateDeleteCounts | null>(null)

  const isArchived = program.status === "ARCHIVED"
  const isDraft = program.status === "DRAFT"
  const programType = (program.passType ?? "STAMP_CARD") as PassType
  const typeMeta = PASS_TYPE_META[programType]

  function handleArchive() {
    startDangerTransition(async () => {
      const result = await archivePassTemplate(organizationId, program.id)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success(t("statusUpdated"))
        setShowArchiveDialog(false)
        router.refresh()
      }
    })
  }

  function handleActivate() {
    startDangerTransition(async () => {
      const result = await activateProgram(organizationId, program.id)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success(t("statusUpdated"))
        router.refresh()
      }
    })
  }

  function handleReactivate() {
    startDangerTransition(async () => {
      const result = await reactivateProgram(organizationId, program.id)
      if ("error" in result) {
        toast.error(String(result.error))
      } else {
        toast.success(t("statusUpdated"))
        setShowReactivateDialog(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    startDangerTransition(async () => {
      const result = await deleteProgram(organizationId, program.id, deleteConfirmName)
      if ("error" in result) {
        if (result.counts) {
          setDeleteCounts(result.counts)
        }
        toast.error(String(result.error))
      } else {
        toast.success(t("programDeleted"))
        setShowDeleteDialog(false)
        router.push("/dashboard/programs")
      }
    })
  }

  const statusLabel = program.status === "ACTIVE" ? "Active" : program.status === "DRAFT" ? "Draft" : "Archived"
  const statusColor = program.status === "ACTIVE" ? "text-emerald-600" : program.status === "DRAFT" ? "text-amber-600" : "text-muted-foreground"

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Program info */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        <p className="text-[13px] text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* Status section */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Status</h3>
        <Card className="flex items-center justify-between gap-4 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {typeMeta && <typeMeta.icon className="h-4 w-4 text-muted-foreground" />}
              <p className="text-sm font-medium">{program.name}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("currentStatus")} <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
            </p>
          </div>
        </Card>
      </section>

      {/* Danger Zone */}
      <section className="space-y-4 border-t border-destructive/30 pt-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
        </div>

        {/* Activate (DRAFT only) */}
        {isDraft && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t("activateProgram")}</p>
              <p className="text-xs text-muted-foreground">
                {t("activateDescription")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={handleActivate}
              disabled={isDangerPending}
            >
              {isDangerPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {t("activateProgram")}
            </Button>
          </div>
        )}

        {/* Archive (ACTIVE only) */}
        {program.status === "ACTIVE" && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t("archiveProgram")}</p>
              <p className="text-xs text-muted-foreground">
                {t("archiveDescription")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-warning hover:text-warning"
              onClick={() => setShowArchiveDialog(true)}
              disabled={isDangerPending}
            >
              <Archive className="h-3.5 w-3.5" />
              {t("archiveProgram")}
            </Button>
          </div>
        )}

        {/* Reactivate (ARCHIVED only) */}
        {isArchived && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t("reactivateProgram")}</p>
              <p className="text-xs text-muted-foreground">
                {t("reactivateDescription")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => setShowReactivateDialog(true)}
              disabled={isDangerPending}
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              {t("reactivateProgram")}
            </Button>
          </div>
        )}

        {/* Delete (all statuses) */}
        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("deleteProgram")}</p>
            <p className="text-xs text-muted-foreground">
              {t("deleteDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => {
              setDeleteConfirmName("")
              setDeleteCounts(null)
              setShowDeleteDialog(true)
            }}
            disabled={isDangerPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("deleteProgram")}
          </Button>
        </div>
      </section>

      {/* Archive AlertDialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("archiveProgram")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("archiveDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDangerPending}></AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={handleArchive}
              disabled={isDangerPending}
            >
              {t("archiveProgram")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate AlertDialog */}
      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reactivateProgram")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("reactivateDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDangerPending}></AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={handleReactivate}
              disabled={isDangerPending}
            >
              {t("reactivateProgram")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog (with name confirmation) */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteProgram")}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirm")}
            </DialogDescription>
          </DialogHeader>

          {deleteCounts && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm space-y-1">
              <p className="font-medium text-destructive">The following data will be deleted:</p>
              <ul className="list-disc list-inside text-muted-foreground text-xs space-y-0.5">
                <li>{deleteCounts.passInstances} pass instance{deleteCounts.passInstances !== 1 ? "s" : ""}</li>
                <li>{deleteCounts.interactions} interaction{deleteCounts.interactions !== 1 ? "s" : ""}</li>
                <li>{deleteCounts.rewards} reward{deleteCounts.rewards !== 1 ? "s" : ""}</li>
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              {t("typeToConfirm", { name: program.name })}
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={program.name}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isDangerPending}></Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmName !== program.name || isDangerPending}
            >
              {t("deleteProgram")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
