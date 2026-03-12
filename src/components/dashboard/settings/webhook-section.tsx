"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import {
  Webhook,
  Plus,
  Copy,
  Trash2,
  RotateCw,
  Power,
  PowerOff,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { Card } from "@/components/ui/card"
import {
  listWebhookEndpoints,
  createWebhookEndpoint,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  rotateWebhookSecret,
  type WebhookEndpointListItem,
} from "@/server/api-key-actions"

const AVAILABLE_EVENTS = [
  { value: "contact.created", label: "Contact created" },
  { value: "contact.updated", label: "Contact updated" },
  { value: "contact.deleted", label: "Contact deleted" },
  { value: "pass.issued", label: "Pass issued" },
  { value: "pass.completed", label: "Pass completed" },
  { value: "pass.suspended", label: "Pass suspended" },
  { value: "pass.revoked", label: "Pass revoked" },
  { value: "interaction.created", label: "Interaction created" },
  { value: "reward.earned", label: "Reward earned" },
  { value: "reward.redeemed", label: "Reward redeemed" },
]

export function WebhookSection() {
  const [endpoints, setEndpoints] = useState<WebhookEndpointListItem[]>([])
  const [isPending, startTransition] = useTransition()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSecretDialog, setShowSecretDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [newUrl, setNewUrl] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [rotatedSecret, setRotatedSecret] = useState("")
  const [showSecret, setShowSecret] = useState(false)

  const loadEndpoints = useCallback(() => {
    startTransition(async () => {
      const result = await listWebhookEndpoints()
      setEndpoints(result)
    })
  }, [])

  useEffect(() => {
    loadEndpoints()
  }, [loadEndpoints])

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    )
  }

  function handleCreate() {
    if (!newUrl.startsWith("https://")) {
      toast.error("URL must use HTTPS.")
      return
    }
    if (selectedEvents.length === 0) {
      toast.error("Select at least one event.")
      return
    }
    startTransition(async () => {
      const result = await createWebhookEndpoint(newUrl, selectedEvents)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setRotatedSecret(result.secret)
      setShowCreateDialog(false)
      setShowSecretDialog(true)
      setNewUrl("")
      setSelectedEvents([])
      loadEndpoints()
    })
  }

  function handleToggleEnabled(endpoint: WebhookEndpointListItem) {
    startTransition(async () => {
      const result = await updateWebhookEndpoint(endpoint.id, {
        enabled: !endpoint.enabled,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(
        endpoint.enabled ? "Webhook disabled." : "Webhook enabled."
      )
      loadEndpoints()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteWebhookEndpoint(id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Webhook endpoint deleted.")
      setDeleteTarget(null)
      loadEndpoints()
    })
  }

  function handleRotateSecret(id: string) {
    startTransition(async () => {
      const result = await rotateWebhookSecret(id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setRotatedSecret(result.secret)
      setShowSecretDialog(true)
      loadEndpoints()
    })
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard.")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Webhook Endpoints</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receive real-time event notifications via HTTP.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add endpoint
        </Button>
      </div>

      {endpoints.length === 0 && !isPending && (
        <Card className="p-6 text-center">
          <Webhook className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No webhook endpoints configured.
          </p>
        </Card>
      )}

      {endpoints.length > 0 && (
        <div className="border rounded-lg divide-y">
          {endpoints.map((ep) => (
            <div key={ep.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono truncate">
                      {ep.url}
                    </code>
                    {!ep.enabled && (
                      <Badge variant="secondary" className="text-[10px]">
                        Disabled
                      </Badge>
                    )}
                    {ep.failureCount >= 5 && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] gap-0.5"
                      >
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {ep.failureCount} failures
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {ep.events.slice(0, 3).map((ev) => (
                      <Badge
                        key={ev}
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        {ev}
                      </Badge>
                    ))}
                    {ep.events.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{ep.events.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleEnabled(ep)}
                    aria-label={ep.enabled ? "Disable" : "Enable"}
                  >
                    {ep.enabled ? (
                      <PowerOff className="h-3.5 w-3.5" />
                    ) : (
                      <Power className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRotateSecret(ep.id)}
                    aria-label="Rotate secret"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(ep.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {ep.lastDeliveryAt && (
                <p className="text-[11px] text-muted-foreground">
                  Last delivery{" "}
                  {formatDistanceToNow(new Date(ep.lastDeliveryAt), {
                    addSuffix: true,
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Webhook Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Webhook Endpoint</DialogTitle>
            <DialogDescription>
              We will send POST requests to this URL when events occur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://example.com/webhooks/loyalshy"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <div>
              <Label>Events to subscribe</Label>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {AVAILABLE_EVENTS.map((ev) => (
                  <label
                    key={ev.value}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted rounded px-2 py-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(ev.value)}
                      onChange={() => toggleEvent(ev.value)}
                      className="rounded border-border"
                    />
                    {ev.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret Dialog (shown after create or rotate) */}
      <Dialog
        open={showSecretDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowSecretDialog(false)
            setRotatedSecret("")
            setShowSecret(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Webhook Signing Secret</DialogTitle>
            <DialogDescription>
              Use this secret to verify webhook signatures. It will only be
              shown once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono break-all">
                {showSecret
                  ? rotatedSecret
                  : rotatedSecret.replace(/./g, "\u2022")}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSecret(!showSecret)}
                aria-label={showSecret ? "Hide secret" : "Show secret"}
              >
                {showSecret ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(rotatedSecret)}
                aria-label="Copy secret"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Store this secret securely. You will not be able to see it again.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowSecretDialog(false)
                setRotatedSecret("")
                setShowSecret(false)
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook Endpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the endpoint and all delivery logs.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
