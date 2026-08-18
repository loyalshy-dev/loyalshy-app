"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Check,
  ChevronsUpDown,
  Handshake,
  LayoutGrid,
  Link2,
  LogOut,
  Plus,
  Settings,
  Share2,
  Smartphone,
  Users,
  Layers,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { authClient } from "@/lib/auth-client"
import { switchActiveOrganization } from "@/server/org-switch-actions"
import {
  NewClientDialog,
  HandoffDialog,
  ReferralLinkDialog,
} from "@/components/dashboard/partner-tools"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ConnectDeviceDialog } from "@/components/dashboard/settings/connect-device"
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
  organizations: {
    id: string
    name: string
    logo: string | null
    logoGoogle: string | null
  }[]
  activeOrganizationId: string
  isPartnerUser: boolean
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function OrgAvatar({
  name,
  logo,
  logoGoogle,
}: {
  name: string
  logo: string | null
  logoGoogle: string | null
}) {
  const src = logoGoogle ?? logo
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="size-7 rounded-md shrink-0 object-cover"
      />
    )
  }
  return (
    <div className="size-7 rounded-md bg-sidebar-accent flex items-center justify-center shrink-0">
      <span className="text-[11px] font-semibold text-sidebar-accent-foreground">
        {getInitials(name)}
      </span>
    </div>
  )
}

export function AppSidebar({
  user,
  organization,
  orgRole,
  organizations,
  activeOrganizationId,
  isPartnerUser,
}: AppSidebarProps) {
  const t = useTranslations("dashboard.nav")
  const pathname = usePathname()
  const router = useRouter()
  const isOwner = orgRole === "owner"
  // Lifted out of the dropdown so the dialog isn't unmounted when the
  // dropdown closes after the menu item is selected.
  const [connectDeviceOpen, setConnectDeviceOpen] = useState(false)
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [referralOpen, setReferralOpen] = useState(false)
  const [isSwitchingOrg, setIsSwitchingOrg] = useState(false)
  // The switcher dropdown exists for multi-org users (agency/partner reps,
  // multi-location owners) and for every partner — partners need its menu
  // to start a new client setup even with a single org.
  const canSwitchOrg = organizations.length > 1 || isPartnerUser

  async function handleSwitchOrg(organizationId: string) {
    if (organizationId === activeOrganizationId || isSwitchingOrg) return
    setIsSwitchingOrg(true)
    const result = await switchActiveOrganization({ organizationId })
    if ("error" in result) {
      setIsSwitchingOrg(false)
      return
    }
    // Full navigation: the current page may belong to the previous org
    // (e.g. a program detail), and a hard load bypasses the client router
    // cache so every surface re-renders against the new active org.
    window.location.assign("/dashboard")
  }

  const navItems = [
    { label: t("overview"), href: "/dashboard", icon: LayoutGrid },
    { label: t("contacts"), href: "/dashboard/contacts", icon: Users },
    { label: t("programs"), href: "/dashboard/programs", icon: Layers },
    ...(isPartnerUser
      ? [{ label: t("partnerConsole"), href: "/dashboard/partner", icon: Handshake }]
      : []),
  ]

  const ownerItems = [
    { label: t("settings"), href: "/dashboard/settings", icon: Settings },
  ]

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
      {/* Organization branding + switcher (dropdown only for multi-org users) */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {canSwitchOrg ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    disabled={isSwitchingOrg}
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    aria-label={t("switchOrganization")}
                  >
                    {organization ? (
                      <OrgAvatar
                        name={organization.name}
                        logo={organization.logo}
                        logoGoogle={organization.logoGoogle}
                      />
                    ) : (
                      <OrgAvatar name="Loyalshy" logo={null} logoGoogle={null} />
                    )}
                    <span className="text-sm font-semibold text-sidebar-primary truncate">
                      {organization?.name ?? "Loyalshy"}
                    </span>
                    <ChevronsUpDown className="ml-auto size-4 shrink-0" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="bottom"
                  align="start"
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                >
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    {t("switchOrganization")}
                  </p>
                  {organizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      disabled={isSwitchingOrg}
                      onSelect={() => handleSwitchOrg(org.id)}
                    >
                      <OrgAvatar
                        name={org.name}
                        logo={org.logo}
                        logoGoogle={org.logoGoogle}
                      />
                      <span className="truncate flex-1">{org.name}</span>
                      {org.id === activeOrganizationId && (
                        <Check className="size-4 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  {isPartnerUser && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          setNewClientOpen(true)
                        }}
                      >
                        <Plus className="size-4" />
                        {t("newClientSetup")}
                      </DropdownMenuItem>
                      {isOwner && organization && (
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            setHandoffOpen(true)
                          }}
                        >
                          <Link2 className="size-4" />
                          {t("handoffToOwner")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          setReferralOpen(true)
                        }}
                      >
                        <Share2 className="size-4" />
                        {t("referralLink")}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent active:bg-transparent">
                {organization ? (
                  <OrgAvatar
                    name={organization.name}
                    logo={organization.logo}
                    logoGoogle={organization.logoGoogle}
                  />
                ) : (
                  <OrgAvatar name="Loyalshy" logo={null} logoGoogle={null} />
                )}
                <span className="text-sm font-semibold text-sidebar-primary truncate">
                  {organization?.name ?? "Loyalshy"}
                </span>
              </SidebarMenuButton>
            )}
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
                      prefetch={true}
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
                {organization ? (
                  <DropdownMenuItem
                    onSelect={(e) => {
                      // Keep dropdown closing behavior, then open the dialog
                      // on the next tick — Radix unmounts the menu before
                      // calling onSelect, which is fine for setState.
                      e.preventDefault()
                      setConnectDeviceOpen(true)
                    }}
                  >
                    <Smartphone className="size-4" />
                    {t("connectDevice")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="size-4" />
                  {t("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {organization ? (
        <ConnectDeviceDialog
          open={connectDeviceOpen}
          onOpenChange={setConnectDeviceOpen}
          organizationName={organization.name}
        />
      ) : null}

      {isPartnerUser ? (
        <>
          <NewClientDialog open={newClientOpen} onOpenChange={setNewClientOpen} />
          <ReferralLinkDialog open={referralOpen} onOpenChange={setReferralOpen} />
        </>
      ) : null}
      {isPartnerUser && organization ? (
        <HandoffDialog
          open={handoffOpen}
          onOpenChange={setHandoffOpen}
          organizationId={activeOrganizationId}
          organizationName={organization.name}
        />
      ) : null}

      <SidebarRail />
    </Sidebar>
  )
}
