"use client"

import { useTransition } from "react"
import { useLocale } from "next-intl"
import { Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { locales, localeNames, type Locale } from "@/i18n/config"
import { cn } from "@/lib/utils"

interface LanguageSwitcherProps {
  className?: string
  size?: "icon-sm" | "icon"
}

export function LanguageSwitcher({ className, size = "icon-sm" }: LanguageSwitcherProps = {}) {
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()

  function switchLocale(newLocale: Locale) {
    if (newLocale === locale) return
    startTransition(() => {
      document.cookie = `locale=${newLocale};path=/;max-age=31536000;samesite=lax`
      window.location.reload()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          disabled={isPending}
          aria-label="Switch language"
          className={className}
        >
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      {/* z-[110] keeps the dropdown above the marketing mobile menu overlay (z-100). */}
      <DropdownMenuContent align="end" className="z-[110]">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchLocale(l)}
            className={cn("py-2.5 text-base", locale === l ? "font-semibold" : "")}
          >
            {localeNames[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
