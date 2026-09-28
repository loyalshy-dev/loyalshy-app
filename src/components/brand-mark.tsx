import { cn } from "@/lib/utils"

// The Loyalshy mark: four stamped dots and the one still to earn. Same
// geometry as the staff app's BrandMark, the app icon and the favicon
// (dot 180, gap 36, ring stroke 0.15 × dot), so every appearance of the
// mark is the same drawing at a different size.
const UNITS = { dot: 180, gap: 36, count: 5 }
const ART_W = UNITS.dot * UNITS.count + UNITS.gap * (UNITS.count - 1) // 1044
const RING = UNITS.dot * 0.15

/** The five dots. Size it by height (`h-*`); color comes from `currentColor`. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${ART_W} ${UNITS.dot}`}
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-4 w-auto shrink-0", className)}
    >
      {Array.from({ length: UNITS.count }, (_, i) => {
        const cx = UNITS.dot / 2 + i * (UNITS.dot + UNITS.gap)
        return i === UNITS.count - 1 ? (
          <circle
            key={i}
            cx={cx}
            cy={UNITS.dot / 2}
            r={UNITS.dot / 2 - RING / 2}
            fill="none"
            stroke="currentColor"
            strokeWidth={RING}
          />
        ) : (
          <circle key={i} cx={cx} cy={UNITS.dot / 2} r={UNITS.dot / 2} />
        )
      })}
    </svg>
  )
}

/**
 * The mark with the name. `inline` (navbar, footer) sets the dots beside
 * the name; `stacked` (auth screens) puts them above, as on the staff app's
 * sign-in. Size it with a text size on `className` — the dots follow the
 * font size. The dots are always coral; the name takes the text color.
 */
export function Wordmark({
  layout = "inline",
  className,
}: {
  layout?: "inline" | "stacked"
  className?: string
}) {
  const stacked = layout === "stacked"
  return (
    <span
      role="img"
      aria-label="Loyalshy"
      className={cn(
        "inline-flex items-center",
        stacked ? "flex-col gap-[0.45em]" : "gap-[0.5em]",
        className
      )}
    >
      <BrandMark className={cn("text-primary", stacked ? "h-[0.62em]" : "h-[0.52em]")} />
      <span aria-hidden="true" className="font-display font-bold leading-none">
        Loyalshy
      </span>
    </span>
  )
}
