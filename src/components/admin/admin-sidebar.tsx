"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Building2,
  ChevronLeft,
  Image,
  LogOut,
  LayoutDashboard,
  Shield,
  Users,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type AdminSidebarProps = {
  user: {
    name: string
    email: string
    image: string | null
    restaurantId: string | null
  }
}

const navItems = [
  { label: "Overview", href: "/admin", icon: BarChart3 },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Restaurants", href: "/admin/restaurants", icon: Building2 },
  { label: "Showcase", href: "/admin/showcase", icon: Image },
]

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin"
    return pathname.startsWith(href)
  }

  const handlePrefetch = useCallback(
    (href: string) => () => {
      router.prefetch(href)
    },
    [router]
  )

  async function handleSignOut() {
    await authClient.signOut()
    window.location.href = "/login"
  }

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-svh bg-sidebar border-r border-sidebar-border transition-[width] duration-200 ease-out",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      {/* Admin branding */}
      <div className="flex items-center gap-3 px-3 h-14 border-b border-sidebar-border shrink-0">
        <div className="size-7 rounded-md bg-amber-500/15 flex items-center justify-center shrink-0">
          <Shield className="size-4 text-amber-500" strokeWidth={1.75} />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-sidebar-primary truncate">
            Admin Panel
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Admin navigation" className="flex-1 flex flex-col gap-0.5 px-2 py-3 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href)
          const link = (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={handlePrefetch(item.href)}
              className={cn(
                "flex items-center gap-3 rounded-md px-2.5 h-8 text-[13px] font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          }

          return link
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 pb-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full h-7 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={cn(
              "size-4 transition-transform duration-200",
              collapsed && "rotate-180"
            )}
            strokeWidth={1.75}
          />
        </button>
      </div>

      {/* User section */}
      <div className="border-t border-sidebar-border px-2 py-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-2.5 w-full rounded-md px-2 py-1.5 hover:bg-sidebar-accent/60 transition-colors outline-none",
                collapsed && "justify-center"
              )}
              aria-label="User menu"
            >
              <Avatar className="size-6 shrink-0">
                <AvatarImage src={user.image ?? undefined} alt={user.name} />
                <AvatarFallback className="text-[10px] font-medium bg-sidebar-accent text-sidebar-accent-foreground">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[13px] font-medium text-sidebar-primary truncate w-full text-left">
                    {user.name}
                  </span>
                  <span className="text-[11px] text-sidebar-foreground/60 truncate w-full text-left">
                    {user.email}
                  </span>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={collapsed ? "right" : "top"}
            align="start"
            className="w-56"
          >
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
            {user.restaurantId && (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-4" />
                    Back to Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
