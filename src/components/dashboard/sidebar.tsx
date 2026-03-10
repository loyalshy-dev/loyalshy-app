"use client"

import { useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ChevronsUpDown,
  LayoutGrid,
  LogOut,
  Settings,
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"

type AppSidebarProps = {
  user: {
    name: string
    email: string
    image: string | null
  }
  organization: {
    name: string
    logo: string | null
    logoGoogle: string | null
  } | null
  orgRole: string | null
}

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutGrid },
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

export function AppSidebar({ user, organization, orgRole }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isOwner = orgRole === "owner"

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
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
    <Sidebar collapsible="icon">
      {/* Organization branding */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent active:bg-transparent">
              {(organization?.logoGoogle ?? organization?.logo) ? (
                <img
                  src={(organization.logoGoogle ?? organization.logo)!}
                  alt={organization.name}
                  className="size-7 rounded-md shrink-0 object-cover"
                />
              ) : (
                <div className="size-7 rounded-md bg-sidebar-accent flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-semibold text-sidebar-accent-foreground">
                    {organization ? getInitials(organization.name) : "L"}
                  </span>
                </div>
              )}
              <span className="text-sm font-semibold text-sidebar-primary truncate">
                {organization?.name ?? "Loyalshy"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link
                      href={item.href}
                      onMouseEnter={handlePrefetch(item.href)}
                    >
                      <item.icon strokeWidth={1.75} />
                      <span translate="no">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isOwner && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {ownerItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.href)}
                        tooltip={item.label}
                      >
                        <Link
                          href={item.href}
                          onMouseEnter={handlePrefetch(item.href)}
                        >
                          <item.icon strokeWidth={1.75} />
                          <span translate="no">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* User section */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-7 shrink-0">
                    <AvatarImage src={user.image ?? undefined} alt={user.name} />
                    <AvatarFallback className="text-[10px] font-medium bg-sidebar-accent text-sidebar-accent-foreground">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start min-w-0 flex-1">
                    <span className="text-[13px] font-medium text-sidebar-primary truncate w-full text-left">
                      {user.name}
                    </span>
                    <span className="text-[11px] text-sidebar-foreground/60 truncate w-full text-left">
                      {user.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
              >
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
