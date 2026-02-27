"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  Gift,
  Layers,
  Plus,
  Search,
  Settings,
  Stamp,
  UserPlus,
  Users,
} from "lucide-react"
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
      <CommandInput placeholder="Search customers, actions, pages..." />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-1 py-4">
            <Search className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No results found.</p>
          </div>
        </CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() => runCommand(onRegisterVisit)}
          >
            <Stamp className="size-4" />
            Register Visit
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard/customers?action=add"))}
          >
            <UserPlus className="size-4" />
            Add Customer
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard/rewards?action=redeem"))}
          >
            <Gift className="size-4" />
            Redeem Reward
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard"))}
          >
            <BarChart3 className="size-4" />
            Overview
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => router.push("/dashboard/customers"))
            }
          >
            <Users className="size-4" />
            Customers
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => router.push("/dashboard/programs"))
            }
          >
            <Layers className="size-4" />
            Programs
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => router.push("/dashboard/rewards"))
            }
          >
            <Gift className="size-4" />
            Rewards
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => router.push("/dashboard/settings"))
            }
          >
            <Settings className="size-4" />
            Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
