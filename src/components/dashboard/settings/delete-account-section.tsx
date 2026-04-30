"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { deleteOwnAccount } from "@/server/account-actions"

type Props = {
  userEmail: string
}

export function DeleteAccountSection({ userEmail }: Props) {
  const t = useTranslations("dashboard.settingsForms")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [isPending, startTransition] = useTransition()
  const [blockedOrgs, setBlockedOrgs] = useState<string[] | null>(null)

  function handleDelete() {
    setBlockedOrgs(null)
    startTransition(async () => {
      const result = await deleteOwnAccount({ confirmationEmail: confirmation })
      if ("success" in result) {
        toast.success(t("deleteAccountSuccess"))
        // Sessions are already gone from the DB; just route off the
        // dashboard. The stale cookie is harmless — proxy.ts will redirect
        // through /login on the next protected nav.
        router.replace("/")
        return
      }
      if (result.error === "last_owner") {
        setBlockedOrgs(result.orgNames)
        return
      }
      if (result.error === "wrong_email") {
        toast.error(t("deleteAccountWrongEmail"))
        return
      }
    })
  }

  return (
    <Card className="border-destructive/50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 shrink-0">
            <TriangleAlert className="size-4 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-medium">{t("deleteAccountTitle")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
              {t("deleteAccountDescription")}
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            setBlockedOrgs(null)
            setConfirmation("")
            setOpen(true)
          }}
        >
          {t("deleteAccountButton")}
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteAccountTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>{t("deleteAccountConfirmIntro")}</p>
                <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                  <li>{t("deleteAccountConsequence1")}</li>
                  <li>{t("deleteAccountConsequence2")}</li>
                  <li>{t("deleteAccountConsequence3")}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {blockedOrgs ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive space-y-2">
              <p className="font-medium">{t("deleteAccountLastOwnerTitle")}</p>
              <p>{t("deleteAccountLastOwnerBody")}</p>
              <ul className="list-disc pl-4">
                {blockedOrgs.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="confirm-email" className="text-xs">
                {t("deleteAccountTypeEmail", { email: userEmail })}
              </Label>
              <Input
                id="confirm-email"
                type="email"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={userEmail}
                autoComplete="off"
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t("deleteAccountCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={
                isPending ||
                !!blockedOrgs ||
                confirmation.toLowerCase() !== userEmail.toLowerCase()
              }
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isPending ? t("deleteAccountWorking") : t("deleteAccountConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
