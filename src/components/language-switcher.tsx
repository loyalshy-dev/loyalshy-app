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

export function LanguageSwitcher() {
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
          size="icon-sm"
          disabled={isPending}
          aria-label="Switch language"
        >
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchLocale(l)}
            className={locale === l ? "font-semibold" : ""}
          >
            {localeNames[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
