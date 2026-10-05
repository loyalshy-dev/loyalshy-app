"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

import { Wordmark } from "@/components/brand-mark"
import { LanguageSwitcher } from "@/components/language-switcher"
import { cn } from "@/lib/utils"
import { localeNames, locales, type Locale } from "@/i18n/config"
import { localePath, parseMarketingPath } from "@/i18n/marketing"
import { useLocalePath } from "@/i18n/use-locale-path"

// The global bar. At the top of the page it runs edge to edge over a
// hairline; once the page scrolls it lifts into a floating translucent
// capsule, a little narrower than the page. Links go to the secondary pages
// (no anchors into the landing since 2026-10-04) and the one of the page on
// screen is marked. The language shows as its code ("ES") and opens the
// same dropdown as the dashboard's switcher; there is no theme toggle (the
// marketing site is forced light). The one action is the coral pill. On phones the bar is 44px and
// the menu is a full-screen sheet over everything (bar included) with its
// own close button, so it reads the same wherever the page was scrolled.

interface NavLink {
  label: string
  href: string
}

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

  // Five pages. The link of the page on screen is the active one; the
  // industry pages all light "For your business".
  const links: NavLink[] = [
    { label: t("forBusiness"), href: lp("/for") },
    { label: t("automations"), href: lp("/automations") },
    { label: t("staffApp"), href: lp("/staff-app") },
    { label: t("pricing"), href: lp("/pricing") },
    { label: tCommon("contact"), href: lp("/contact") },
  ]
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  // Lift the bar into its capsule once the page has moved.
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

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
                data-active={isActive(link.href)}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mk-nav-actions">
            <LanguageSwitcher variant="code" className="mk-nav-link mk-nav-lang" />
            <span className="mk-nav-sep" aria-hidden="true" />
            <Link href="/login" prefetch={false} className="mk-nav-link mk-nav-link-strong">
              {tCommon("logIn")}
            </Link>
            <Link href="/register" prefetch={false} className="mk-nav-pill">
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
                  <Link href={link.href} prefetch={link.href.startsWith("/login") || link.href.startsWith("/register") ? false : undefined} onClick={() => setOpen(false)} className="mk-nav-menu-link" tabIndex={open ? 0 : -1}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <MenuLanguages pathname={pathname} open={open} />
        </div>
      </div>
    </header>
  )
}

// The languages at the foot of the phone menu, the current one in
// ink. Plain links to the same page in the other language; the cookie is
// written first so the unprefixed English URL isn't bounced back by the
// locale redirect in next.config.ts.
function MenuLanguages({ pathname, open }: { pathname: string; open: boolean }) {
  const t = useTranslations("nav")
  const current = useLocale() as Locale
  const path = parseMarketingPath(pathname)?.path ?? "/"
  return (
    <nav className="mk-nav-menu-langs" aria-label={t("switchLanguage")}>
      {locales.map((l) => (
        <a
          key={l}
          href={localePath(l, path)}
          lang={l}
          hrefLang={l}
          aria-current={l === current ? "true" : undefined}
          tabIndex={open ? 0 : -1}
          onClick={() => {
            document.cookie = `locale=${l};path=/;max-age=31536000;samesite=lax`
          }}
        >
          {localeNames[l]}
        </a>
      ))}
    </nav>
  )
}
