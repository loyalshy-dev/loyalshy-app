"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { Wordmark } from "@/components/brand-mark"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { useLocalePath } from "@/i18n/use-locale-path"

// The global bar. At the top of the page it runs edge to edge over a
// hairline; once the page scrolls it lifts into a floating translucent
// capsule, a little narrower than the page. Links show which section is on
// screen. The one action is the coral pill. On phones the bar is 44px and
// the menu is a full-screen sheet over everything (bar included) with its
// own close button, so it reads the same wherever the page was scrolled.

interface NavLink {
  label: string
  href: string
  /** Section id on the landing this link points at (for the active state). */
  section?: string
}

const SECTIONS = ["cards", "features", "faq"] as const

export function MarketingNavbar() {
  const t = useTranslations("nav")
  const tCommon = useTranslations("common")
  const lp = useLocalePath()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const burgerRef = React.useRef<HTMLButtonElement>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const wasOpen = React.useRef(false)
  const [active, setActive] = React.useState<string | null>(null)
  const onLanding = pathname === lp("/")

  const links: NavLink[] = [
    { label: t("cards"), href: `${lp("/")}#cards`, section: "cards" },
    { label: t("dashboard"), href: `${lp("/")}#features`, section: "features" },
    { label: t("pricing"), href: lp("/pricing"), section: "pricing" },
    { label: t("faq"), href: `${lp("/")}#faq`, section: "faq" },
    { label: tCommon("contact"), href: lp("/contact"), section: "contact" },
  ]
  // Off the landing, the link of the page itself is the active one.
  const PAGE_SECTIONS: Record<string, string> = { [lp("/pricing")]: "pricing", [lp("/contact")]: "contact" }
  const current = onLanding ? active : (PAGE_SECTIONS[pathname] ?? null)

  // Lift the bar into its capsule once the page has moved.
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Which section is on screen: the one whose top has passed the upper
  // third of the viewport and whose bottom has not.
  React.useEffect(() => {
    if (!onLanding) return
    const els = SECTIONS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el))
    if (els.length === 0) return
    const visible = new Map<string, boolean>()
    const update = () => {
      const hit = SECTIONS.find((id) => visible.get(id))
      setActive(hit ?? null)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting)
        update()
      },
      { rootMargin: "-34% 0px -60% 0px", threshold: 0 },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [onLanding])

  // On the landing the wordmark just scrolls to the top; elsewhere it goes home.
  const onBrand = (e: React.MouseEvent<HTMLAnchorElement>) => {
    setOpen(false)
    if (window.location.pathname === lp("/")) {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  // Lock the page behind the open menu. iOS Safari ignores overflow on
  // <body> alone, so the root element gets it too.
  React.useEffect(() => {
    const targets = [document.documentElement, document.body]
    for (const el of targets) el.style.overflow = open ? "hidden" : ""
    return () => {
      for (const el of targets) el.style.overflow = ""
    }
  }, [open])

  // Focus follows the sheet: the close button when it opens, the burger
  // when it closes.
  React.useEffect(() => {
    if (open) closeRef.current?.focus()
    else if (wasOpen.current) burgerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="mk-nav-bar" data-scrolled={scrolled} data-open={open}>
        <div className="mk-nav-inner">
          <Link href={lp("/")} className="mk-nav-brand" aria-label={t("home")} onClick={onBrand}>
            <Wordmark className="text-[19px]" />
          </Link>

          <nav className="mk-nav-links" aria-label="Main navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="mk-nav-link"
                data-active={current === link.section}
                aria-current={current === link.section ? "location" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mk-nav-actions">
            <LanguageSwitcher className="mk-nav-icon" />
            <ThemeToggle className="mk-nav-icon" />
            <span className="mk-nav-sep" aria-hidden="true" />
            <Link href="/login" className="mk-nav-link mk-nav-link-strong">
              {tCommon("logIn")}
            </Link>
            <Link href="/register" className="mk-nav-pill">
              {tCommon("getStartedFree")}
            </Link>
          </div>

          <button
            ref={burgerRef}
            type="button"
            className="mk-nav-burger"
            aria-label={open ? t("closeMenu") : t("openMenu")}
            aria-expanded={open}
            aria-controls="mk-nav-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className={cn("mk-nav-burger-line", open && "mk-nav-burger-line-a")} />
            <span className={cn("mk-nav-burger-line", open && "mk-nav-burger-line-b")} />
          </button>
        </div>
      </div>

      {/* Phone menu: a full-screen sheet with its own close button; the
          links, then sign in and sign up, as one list in large type */}
      <div id="mk-nav-menu" className={cn("mk-nav-menu", open && "mk-nav-menu-open")} aria-hidden={!open}>
        <div className="mk-wrap">
          <div className="mk-nav-menu-top">
            <button ref={closeRef} type="button" className="mk-nav-close" aria-label={t("closeMenu")} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M3 3l16 16M19 3L3 19" />
              </svg>
            </button>
          </div>
          <nav aria-label="Mobile navigation">
            <ul className="mk-nav-menu-list">
              {[...links, { label: tCommon("logIn"), href: "/login" }, { label: tCommon("getStartedFree"), href: "/register" }].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} onClick={() => setOpen(false)} className="mk-nav-menu-link" tabIndex={open ? 0 : -1}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mk-nav-menu-foot">
            <LanguageSwitcher size="icon" className="size-10" />
            <ThemeToggle className="size-10" />
          </div>
        </div>
      </div>
    </header>
  )
}
