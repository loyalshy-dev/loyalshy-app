"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/language-switcher"
import { cn } from "@/lib/utils"

interface NavLink {
  label: string
  href: string
}

export function MarketingNavbar() {
  const t = useTranslations("nav")
  const tCommon = useTranslations("common")

  const [scrolled, setScrolled] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const NAV_LINKS: NavLink[] = [
    { label: t("features"), href: "/#features" },
    { label: t("pricing"), href: "/#pricing" },
    { label: t("faq"), href: "/#faq" },
    { label: tCommon("contact"), href: "/contact" },
  ]

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8)
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Lock body scroll when mobile menu is open
  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-200",
          scrolled
            ? "border-b border-(--mk-border) bg-(--mk-bg)/80 backdrop-blur-lg"
            : "border-b border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-16 w-full items-center justify-between px-6 sm:px-8 lg:px-10">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center transition-opacity hover:opacity-80"
            aria-label={t("home")}
          >
            <Image
              src="/logo.svg"
              alt={tCommon("loyalshy")}
              width={160}
              height={44}
              className="h-14 w-auto dark:invert"
              priority
            />
          </Link>

          {/* Center nav links — desktop only */}
          <nav
            className="hidden md:flex md:items-center md:gap-3"
            aria-label="Main navigation"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-5 py-2.5 text-base font-medium transition-colors duration-150",
                  "hover:text-(--mk-text)",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                )}
                style={{ color: "var(--mk-text-muted)" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side actions — desktop */}
          <div className="hidden items-center gap-5 md:flex">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="text-base font-medium transition-colors"
              style={{ color: "var(--mk-text-muted)" }}
            >
              {tCommon("logIn")}
            </Link>
            <Link
              href="/register"
              className="mk-btn-primary py-3! px-8! text-base!"
            >
              {tCommon("getStarted")}
            </Link>
          </div>

          {/* Mobile: hamburger trigger */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            style={{ color: "var(--mk-text-muted)" }}
            aria-label={t("openMenu")}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </header>

      {/* Full-screen mobile menu overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col md:hidden"
          style={{ background: "var(--mk-bg)" }}
        >
          {/* Close button — top right, respects notch */}
          <div className="flex justify-end px-6 safe-area-top" style={{ paddingTop: "max(env(safe-area-inset-top, 1.25rem), 1.25rem)" }}>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t("closeMenu")}
              className="p-3 -mr-3 transition-opacity hover:opacity-60"
              style={{ color: "var(--mk-text-muted)" }}
            >
              <X className="size-6" />
            </button>
          </div>

          {/* Nav links — large, spacious */}
          <nav
            className="flex flex-1 flex-col gap-2 px-8 pt-6"
            aria-label="Mobile navigation"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-[1.75rem] font-bold tracking-tight py-3 transition-opacity hover:opacity-60"
                style={{ color: "var(--mk-text)" }}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="text-[1.75rem] font-bold tracking-tight py-3 transition-opacity hover:opacity-60"
              style={{ color: "var(--mk-text)" }}
            >
              {tCommon("logIn")}
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="text-[1.75rem] font-bold tracking-tight py-3 transition-opacity hover:opacity-60"
              style={{ color: "var(--mk-text)" }}
            >
              {tCommon("getStarted")}
            </Link>
          </nav>
        </div>
      )}
    </>
  )
}
