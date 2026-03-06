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
        toast.success("Program archived")
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
        toast.success("Program activated")
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
        toast.success("Program reactivated")
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
        toast.success("Program deleted")
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
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="text-[13px] text-muted-foreground mt-1">
          Manage the status and lifecycle of your program. Program configuration and card design are edited in the Card Design tab.
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
              Current status: <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
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
              <p className="text-sm font-medium">Activate program</p>
              <p className="text-xs text-muted-foreground">
                Make this program live so customers can start earning visits.
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
              Activate
            </Button>
          </div>
        )}

        {/* Archive (ACTIVE only) */}
        {program.status === "ACTIVE" && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Archive program</p>
              <p className="text-xs text-muted-foreground">
                Active enrollments will be frozen and customers won&apos;t earn new visits.
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
              Archive
            </Button>
          </div>
        )}

        {/* Reactivate (ARCHIVED only) */}
        {isArchived && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Reactivate program</p>
              <p className="text-xs text-muted-foreground">
                Set the program back to active and unfreeze all frozen enrollments.
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
              Reactivate
            </Button>
          </div>
        )}

        {/* Delete (all statuses) */}
        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Delete program</p>
            <p className="text-xs text-muted-foreground">
              Permanently delete this program, including all passes, interactions, and rewards. This cannot be undone.
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
            Delete
          </Button>
        </div>
      </section>

      {/* Archive AlertDialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive program</AlertDialogTitle>
            <AlertDialogDescription>
              Active enrollments will be frozen and customers won&apos;t earn new visits.
              Earned rewards will remain valid. You can reactivate the program later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDangerPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={handleArchive}
              disabled={isDangerPending}
            >
              {isDangerPending ? "Archiving..." : "Archive program"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate AlertDialog */}
      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate program</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the program back to active and unfreeze all frozen enrollments.
              Customers will be able to earn visits again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDangerPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={handleReactivate}
              disabled={isDangerPending}
            >
              {isDangerPending ? "Reactivating..." : "Reactivate program"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog (with name confirmation) */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete program</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All data associated with
              this program will be deleted.
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
              Type <span className="font-semibold">{program.name}</span> to confirm
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
              <Button variant="outline" disabled={isDangerPending}>Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmName !== program.name || isDangerPending}
            >
              {isDangerPending ? "Deleting..." : "Delete program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
