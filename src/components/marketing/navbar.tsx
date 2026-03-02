"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/*
 * Usage example:
 *
 * import { MarketingNavbar } from "@/components/marketing/navbar"
 *
 * export default function LandingLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <>
 *       <MarketingNavbar />
 *       <main>{children}</main>
 *     </>
 *   )
 * }
 */

interface NavLink {
  label: string
  href: string
}

const NAV_LINKS: NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
]

export function MarketingNavbar() {
  const [scrolled, setScrolled] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8)
    }

    // Set initial state in case page loads mid-scroll
    handleScroll()

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-200",
        scrolled
          ? "border-b border-border/60 bg-background/80 backdrop-blur-lg"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center transition-opacity hover:opacity-80"
          aria-label="Loyalshy home"
        >
          <Image
            src="/logo.png"
            alt="Loyalshy"
            width={120}
            height={32}
            className="h-10 w-auto dark:invert"
            priority
          />
        </Link>

        {/* Center nav links — desktop only */}
        <nav
          className="hidden md:flex md:items-center md:gap-1"
          aria-label="Main navigation"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground",
                "transition-colors duration-150 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side actions — desktop */}
        <div className="hidden items-center gap-2 md:flex">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            <Link href="/login">Log In</Link>
          </Button>
          <Button
            size="sm"
            asChild
            className="text-[13px] font-medium"
          >
            <Link href="/register">Start Free Trial</Link>
          </Button>
        </div>

        {/* Mobile: hamburger trigger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden text-muted-foreground"
              aria-label="Open menu"
            >
              <Menu className="size-4.5" />
            </Button>
          </SheetTrigger>

          <SheetContent side="right" className="w-72 p-0" showCloseButton={false}>
            <SheetHeader className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between">
                <SheetTitle asChild>
                  <Link
                    href="/"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center"
                  >
                    <Image
                      src="/logo.png"
                      alt="Loyalshy"
                      width={120}
                      height={32}
                      className="h-6 w-auto dark:invert"
                    />
                  </Link>
                </SheetTitle>
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    aria-label="Close menu"
                  >
                    {/* Using inline SVG to avoid importing X separately */}
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 15 15"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
                        fill="currentColor"
                        fillRule="evenodd"
                        clipRule="evenodd"
                      />
                    </svg>
                  </Button>
                </SheetClose>
              </div>
            </SheetHeader>

            {/* Mobile nav links */}
            <nav
              className="flex flex-col px-3 py-4"
              aria-label="Mobile navigation"
            >
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-[13px] font-medium text-muted-foreground",
                    "transition-colors duration-150 hover:bg-accent hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Mobile CTA buttons */}
            <div className="flex flex-col gap-2 border-t border-border px-4 py-4">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full text-[13px] font-medium"
              >
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  Log In
                </Link>
              </Button>
              <Button
                size="sm"
                asChild
                className="w-full text-[13px] font-medium"
              >
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  Start Free Trial
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
