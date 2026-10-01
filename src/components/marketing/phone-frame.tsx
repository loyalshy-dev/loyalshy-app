import type { CSSProperties, ReactNode } from "react"

// One phone for the whole landing, drawn to look like the real thing: a
// titanium band with a light edge, a black bezel, the island with its
// camera, side buttons, a status bar and a faint glass highlight.
//
// Every dimension is derived in CSS from `--phone-w` (the phone's width),
// so the phone can be sized by a media query or a viewport-relative
// expression without JavaScript: the server and the first client paint
// agree, and a short viewport can hand the phone a smaller width. The
// screen keeps the iPhone ratio (390 × 844). Children are laid out against
// the screen box and may read `--phone-w` / `--sw` (screen width) for their
// own proportions. `width` may itself be a `var()` from an ancestor — it is
// copied into `--phone-w`, never into a variable of the same name.

const INK = "#1F1410"

function StatusIcons({ color }: { color: string }) {
  return (
    <span className="flex items-center gap-[5px]" aria-hidden="true">
      <svg width="15" height="10" viewBox="0 0 15 10" fill={color}>
        <rect x="0" y="6" width="3" height="4" rx="0.8" />
        <rect x="4" y="4" width="3" height="6" rx="0.8" />
        <rect x="8" y="2" width="3" height="8" rx="0.8" />
        <rect x="12" y="0" width="3" height="10" rx="0.8" />
      </svg>
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
        <path d="M1 3.5a9 9 0 0 1 12 0" />
        <path d="M3.4 6a5.6 5.6 0 0 1 7.2 0" />
        <path d="M5.8 8.4a2.2 2.2 0 0 1 2.4 0" />
      </svg>
      <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
        <rect x="0.5" y="0.5" width="20" height="10" rx="3" stroke={color} strokeOpacity="0.4" />
        <rect x="2" y="2" width="15" height="7" rx="1.8" fill={color} />
        <path d="M22 3.5v4a2 2 0 0 0 0-4Z" fill={color} fillOpacity="0.4" />
      </svg>
    </span>
  )
}

const METAL = "linear-gradient(180deg, #7a726d, #3a3532 40%, #26221f)"

export function PhoneFrame({
  width = 280,
  children,
  className,
  style,
  screenBackground = "var(--mk-surface)",
  status = true,
  statusTime = false,
  statusColor = INK,
}: {
  /** A number in px, or any CSS length expression (e.g. `var(--pw)`, `min(230px, 30svh)`). */
  width?: number | string
  children: ReactNode
  className?: string
  style?: CSSProperties
  screenBackground?: string
  /** Draw the status bar (off when the screen is a screenshot that has its own). */
  status?: boolean
  /** Show the time top-left (apps do; the lock screen does not). */
  statusTime?: boolean
  statusColor?: string
}) {
  const vars = {
    "--phone-w": typeof width === "number" ? `${width}px` : width,
    "--band": "max(2px, var(--phone-w) * 0.012)",
    "--bezel": "calc(var(--phone-w) * 0.03)",
    "--radius": "calc(var(--phone-w) * 0.17)",
    "--sw": "calc(var(--phone-w) - 2 * (var(--band) + var(--bezel)))",
    "--sh": "calc(var(--sw) * 844 / 390)",
    "--island-w": "calc(var(--sw) * 0.3)",
    "--island-h": "calc(var(--sw) * 0.085)",
    "--island-top": "calc(var(--sw) * 0.03)",
    "--btn": "max(2px, var(--phone-w) * 0.012)",
  } as CSSProperties

  const sideButton = (side: "left" | "right", top: string, height: string) => (
    <span
      aria-hidden="true"
      style={{ position: "absolute", [side]: "calc(-1 * var(--btn))", top, width: "var(--btn)", height, borderRadius: 2, background: METAL }}
    />
  )

  return (
    <div className={className} style={{ ...vars, width: "var(--phone-w)", position: "relative", ...style }}>
      {sideButton("left", "calc(var(--sh) * 0.16)", "calc(var(--phone-w) * 0.07)")}
      {sideButton("left", "calc(var(--sh) * 0.26)", "calc(var(--phone-w) * 0.13)")}
      {sideButton("left", "calc(var(--sh) * 0.26 + var(--phone-w) * 0.16)", "calc(var(--phone-w) * 0.13)")}
      {sideButton("right", "calc(var(--sh) * 0.3)", "calc(var(--phone-w) * 0.2)")}

      {/* Titanium band */}
      <div
        style={{
          borderRadius: "var(--radius)",
          padding: "var(--band)",
          background: "linear-gradient(160deg, #8a827c 0%, #3b3633 30%, #1c1917 62%, #5a534e 100%)",
          boxShadow: "0 40px 80px -28px oklch(0 0 0 / 0.5), 0 12px 28px -12px oklch(0 0 0 / 0.35), 0 0 0 0.5px oklch(0 0 0 / 0.35)",
        }}
      >
        {/* Bezel */}
        <div style={{ borderRadius: "calc(var(--radius) - var(--band))", padding: "var(--bezel)", background: "#070606" }}>
          {/* Screen */}
          <div
            className="relative overflow-hidden"
            style={{ width: "var(--sw)", height: "var(--sh)", borderRadius: "calc(var(--radius) - var(--band) - var(--bezel))", background: screenBackground }}
          >
            {/* Island */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full"
              style={{ top: "var(--island-top)", width: "var(--island-w)", height: "var(--island-h)", background: "#000" }}
            >
              <span
                className="absolute top-1/2 -translate-y-1/2 rounded-full"
                style={{ right: "calc(var(--island-h) * 0.32)", width: "calc(var(--island-h) * 0.36)", height: "calc(var(--island-h) * 0.36)", background: "#161418", boxShadow: "inset 0 0 0 1px #2a2530" }}
              />
            </div>

            {/* Status bar */}
            {status && (
              <div
                className="absolute inset-x-0 z-30 flex items-center justify-between"
                style={{ top: "var(--island-top)", height: "var(--island-h)", paddingInline: "calc(var(--sw) * 0.085)", color: statusColor }}
              >
                <span className="text-[12px] font-semibold tabular-nums" style={{ letterSpacing: "-0.01em" }}>{statusTime ? "9:41" : ""}</span>
                <StatusIcons color={statusColor} />
              </div>
            )}

            {children}

            {/* Glass */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-20"
              style={{ background: "linear-gradient(112deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 26%, rgba(255,255,255,0) 44%)" }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
