"use client"

import { useState, useTransition, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Key, Plus, Copy, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react"
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
  listApiKeys,
  createApiKey,
  revokeApiKey,
  type ApiKeyListItem,
} from "@/server/api-key-actions"

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyListItem[]>([])
  const [isPending, startTransition] = useTransition()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSecretDialog, setShowSecretDialog] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState("")
  const [createdKey, setCreatedKey] = useState("")
  const [showKey, setShowKey] = useState(false)

  const loadKeys = useCallback(() => {
    startTransition(async () => {
      const result = await listApiKeys()
      setKeys(result)
    })
  }, [])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  function handleCreate() {
    startTransition(async () => {
      const result = await createApiKey(newKeyName)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setCreatedKey(result.fullKey)
      setShowCreateDialog(false)
      setShowSecretDialog(true)
      setNewKeyName("")
      loadKeys()
    })
  }

  function handleRevoke(keyId: string) {
    startTransition(async () => {
      const result = await revokeApiKey(keyId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("API key revoked.")
      setRevokeTarget(null)
      loadKeys()
    })
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard.")
  }

  const activeKeys = keys.filter((k) => !k.revokedAt)
  const revokedKeys = keys.filter((k) => k.revokedAt)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">API Keys</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage API keys for programmatic access.{" "}
            <a
              href="/api/v1/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
            >
              View API docs
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Create key
        </Button>
      </div>

      {activeKeys.length === 0 && !isPending && (
        <Card className="p-6 text-center">
          <Key className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No API keys yet. Create one to get started.
          </p>
        </Card>
      )}

      {activeKeys.length > 0 && (
        <div className="border rounded-lg divide-y">
          {activeKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {key.name}
                  </span>
                  {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                    <Badge variant="destructive" className="text-[10px]">
                      Expired
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <code className="text-xs text-muted-foreground font-mono">
                    {key.keyPrefix}...
                  </code>
                  <span className="text-xs text-muted-foreground">
                    Created{" "}
                    {formatDistanceToNow(new Date(key.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                  {key.lastUsedAt && (
                    <span className="text-xs text-muted-foreground">
                      Last used{" "}
                      {formatDistanceToNow(new Date(key.lastUsedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setRevokeTarget(key.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Revoke</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      {revokedKeys.length > 0 && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            {revokedKeys.length} revoked{" "}
            {revokedKeys.length === 1 ? "key" : "keys"}
          </summary>
          <div className="mt-2 border rounded-lg divide-y opacity-60">
            {revokedKeys.map((key) => (
              <div key={key.id} className="flex items-center px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="text-sm line-through">{key.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-xs text-muted-foreground font-mono">
                      {key.keyPrefix}...
                    </code>
                    <Badge variant="secondary" className="text-[10px]">
                      Revoked
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Give your key a descriptive name to identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Production POS"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
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

      {/* Show Secret Dialog */}
      <Dialog
        open={showSecretDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowSecretDialog(false)
            setCreatedKey("")
            setShowKey(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy your API key now. It will only be shown once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono break-all">
                {showKey ? createdKey : createdKey.replace(/./g, "\u2022")}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(createdKey)}
                aria-label="Copy key"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Store this key securely. You will not be able to see it again.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowSecretDialog(false)
                setCreatedKey("")
                setShowKey(false)
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any applications using this key will lose access immediately. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeTarget && handleRevoke(revokeTarget)}
              disabled={isPending}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
