"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { MapPin, Loader2, X } from "lucide-react"

type Suggestion = {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
  lat?: number
  lng?: number
}

type Props = {
  value: string
  onChange: (address: string, lat: number | null, lng: number | null) => void
  placeholder?: string
  maxLength?: number
  labels: {
    searching: string
    noResults: string
  }
}

export function AddressAutocomplete({ value, onChange, placeholder, maxLength = 500, labels }: Props) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync external value changes
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setIsOpen((data.suggestions || []).length > 0)
      setActiveIndex(-1)
    } catch {
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)

    // Clear coordinates when user edits text
    onChange(val, null, null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  async function selectSuggestion(suggestion: Suggestion) {
    setQuery(suggestion.description)
    setIsOpen(false)
    setSuggestions([])

    // Nominatim results have lat/lng directly
    if (suggestion.lat != null && suggestion.lng != null) {
      onChange(suggestion.description, suggestion.lat, suggestion.lng)
      return
    }

    // Google results need a place details fetch
    try {
      const res = await fetch(`/api/places/autocomplete?placeId=${encodeURIComponent(suggestion.placeId)}`)
      const data = await res.json()
      if (data.lat != null && data.lng != null) {
        const address = data.address || suggestion.description
        setQuery(address)
        onChange(address, data.lat, data.lng)
      } else {
        onChange(suggestion.description, null, null)
      }
    } catch {
      onChange(suggestion.description, null, null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[activeIndex])
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  function handleClear() {
    setQuery("")
    setSuggestions([])
    setIsOpen(false)
    onChange("", null, null)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true)
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `place-${activeIndex}` : undefined}
          style={{
            width: "100%",
            padding: "8px 32px 8px 10px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            backgroundColor: "var(--background)",
            fontSize: 12,
            color: "var(--foreground)",
            outline: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {isLoading && (
            <Loader2 size={13} style={{ color: "var(--muted-foreground)", animation: "spin 1s linear infinite" }} />
          )}
          {query && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear address"
              style={{
                background: "none",
                border: "none",
                padding: 2,
                cursor: "pointer",
                color: "var(--muted-foreground)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            maxHeight: 220,
            overflowY: "auto",
            borderRadius: 12,
            border: "1px solid var(--border)",
            backgroundColor: "var(--popover)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: 4,
            margin: 0,
            listStyle: "none",
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`place-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => selectSuggestion(s)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                cursor: "pointer",
                backgroundColor: i === activeIndex ? "var(--accent)" : "transparent",
                transition: "background-color 0.1s ease",
              }}
            >
              <MapPin
                size={14}
                style={{
                  color: "var(--muted-foreground)",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--foreground)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.mainText}
                </div>
                {s.secondaryText && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted-foreground)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {s.secondaryText}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Loading / no results state */}
      {isOpen && isLoading && suggestions.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            borderRadius: 12,
            border: "1px solid var(--border)",
            backgroundColor: "var(--popover)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "12px 14px",
            fontSize: 12,
            color: "var(--muted-foreground)",
            textAlign: "center",
          }}
        >
          {labels.searching}
        </div>
      )}

      {isOpen && !isLoading && query.length >= 2 && suggestions.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            borderRadius: 12,
            border: "1px solid var(--border)",
            backgroundColor: "var(--popover)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "12px 14px",
            fontSize: 12,
            color: "var(--muted-foreground)",
            textAlign: "center",
          }}
        >
          {labels.noResults}
        </div>
      )}
    </div>
  )
}
