import { useSyncExternalStore } from "react"

/**
 * Subscribe to a media query without a setState-in-effect. The server and
 * the first client render both report `false`, so hydration matches; the
 * real value arrives with the store's first client snapshot.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"
