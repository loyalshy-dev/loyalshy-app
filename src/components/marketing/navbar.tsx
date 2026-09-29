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
// the menu drops down full-screen.

interface NavLink {
  label: string
  href: string
  /** Section id on the landing this link points at (for the active state). */
  section?: string
}

const SECTIONS = ["cards", "features", "pricing", "faq"] as const

export function MarketingNavbar() {
  const t = useTranslations("nav")
  const tCommon = useTranslations("common")
  const lp = useLocalePath()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const [active, setActive] = React.useState<string | null>(null)
  const onLanding = pathname === lp("/")

  const links: NavLink[] = [
    { label: t("cards"), href: `${lp("/")}#cards`, section: "cards" },
    { label: t("dashboard"), href: `${lp("/")}#features`, section: "features" },
    { label: t("pricing"), href: `${lp("/")}#pricing`, section: "pricing" },
    { label: t("faq"), href: `${lp("/")}#faq`, section: "faq" },
    { label: tCommon("contact"), href: lp("/contact"), section: "contact" },
  ]
  const current = onLanding ? active : pathname === lp("/contact") ? "contact" : null

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

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
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
                aria-current={current === link.section ? "true" : undefined}
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
            type="button"
            className="mk-nav-burger"
            aria-label={open ? t("closeMenu") : t("openMenu")}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={cn("mk-nav-burger-line", open && "mk-nav-burger-line-a")} />
            <span className={cn("mk-nav-burger-line", open && "mk-nav-burger-line-b")} />
          </button>
        </div>
      </div>

      {/* Phone menu: drops from the bar, links stacked over hairlines */}
      <div className={cn("mk-nav-menu", open && "mk-nav-menu-open")} aria-hidden={!open}>
        <nav aria-label="Mobile navigation" className="mk-wrap">
          <ul className="mk-nav-menu-list">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={() => setOpen(false)} className="mk-nav-menu-link" tabIndex={open ? 0 : -1}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mk-nav-menu-foot">
            <Link href="/register" onClick={() => setOpen(false)} className="mk-btn-primary w-full" tabIndex={open ? 0 : -1}>
              {tCommon("getStartedFree")}
            </Link>
            <Link href="/login" onClick={() => setOpen(false)} className="mk-body font-semibold" style={{ color: "var(--mk-text)" }} tabIndex={open ? 0 : -1}>
              {tCommon("logIn")}
            </Link>
            <div className="flex items-center gap-1">
              <LanguageSwitcher size="icon" className="size-10" />
              <ThemeToggle className="size-10" />
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}
