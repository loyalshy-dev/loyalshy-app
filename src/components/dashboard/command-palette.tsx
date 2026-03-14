"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  LayoutGrid,
  Plus,
  Search,
  Settings,
  Stamp,
} from "lucide-react"
import { useTranslations } from "next-intl"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRegisterVisit: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  onRegisterVisit,
}: CommandPaletteProps) {
  const t = useTranslations("dashboard.nav")
  const router = useRouter()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  function runCommand(fn: () => void) {
    onOpenChange(false)
    fn()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("search")} />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-1 py-4">
            <Search className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          </div>
        </CommandEmpty>

        <CommandGroup heading={t("quickActions")}>
          <CommandItem
            onSelect={() => runCommand(onRegisterVisit)}
          >
            <Stamp className="size-4" />
            {t("registerInteraction")}
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard?action=create"))}
          >
            <Plus className="size-4" />
            {t("createProgram")}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("navigate")}>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard"))}
          >
            <LayoutGrid className="size-4" />
            {t("overview")}
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => router.push("/dashboard/settings"))
            }
          >
            <Settings className="size-4" />
            {t("settings")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
