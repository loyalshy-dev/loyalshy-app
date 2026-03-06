"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Layers,
  LogOut,
  Settings,
  Users,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type MobileSidebarProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    name: string
    email: string
    image: string | null
  }
  organization: {
    name: string
    logo: string | null
  } | null
  orgRole: string | null
}

const navItems = [
  { label: "Overview", href: "/dashboard", icon: BarChart3 },
  { label: "Contacts", href: "/dashboard/customers", icon: Users },
  { label: "Templates", href: "/dashboard/programs", icon: Layers },
]

const ownerItems = [
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
]

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function MobileSidebar({
  open,
  onOpenChange,
  user,
  organization,
  orgRole,
}: MobileSidebarProps) {
  const pathname = usePathname()
  const isOwner = orgRole === "owner"

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  async function handleSignOut() {
    await authClient.signOut()
    window.location.href = "/login"
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0 bg-sidebar [&>button]:text-sidebar-foreground">
        <SheetHeader className="px-4 h-14 flex flex-row items-center gap-3 border-b border-sidebar-border">
          {organization?.logo ? (
            <img
              src={organization.logo}
              alt={organization.name}
              className="size-7 rounded-md object-cover"
            />
          ) : (
            <div className="size-7 rounded-md bg-sidebar-accent flex items-center justify-center">
              <span className="text-[11px] font-semibold text-sidebar-accent-foreground">
                {organization ? getInitials(organization.name) : "L"}
              </span>
            </div>
          )}
          <SheetTitle className="text-sm font-semibold text-sidebar-primary">
            {organization?.name ?? "Loyalshy"}
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-0.5 px-3 py-3">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2.5 h-9 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
                <span>{item.label}</span>
              </Link>
            )
          })}

          {isOwner && (
            <>
              <div className="my-2 h-px bg-sidebar-border" />
              {ownerItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2.5 h-9 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        <div className="mt-auto border-t border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <Avatar className="size-7">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback className="text-[10px] font-medium bg-sidebar-accent text-sidebar-accent-foreground">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-medium text-sidebar-primary truncate">
                {user.name}
              </span>
              <span className="text-[11px] text-sidebar-foreground/60 truncate">
                {user.email}
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full rounded-md px-2.5 h-9 mt-1 text-[13px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="size-4" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
