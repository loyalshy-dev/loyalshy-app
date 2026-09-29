import type { CSSProperties, ReactNode } from "react"

// One phone for the whole landing, drawn to look like the real thing: a
// titanium band with a light edge, a black bezel, the island with its
// camera, side buttons, a status bar and a faint glass highlight. Sized by
// `width`; the screen keeps the iPhone ratio (390 × 844).

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
  width?: number
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
  const band = Math.max(2, Math.round(width * 0.012))
  const bezel = Math.round(width * 0.03)
  const radius = Math.round(width * 0.17)
  const screenW = width - 2 * (band + bezel)
  const screenH = Math.round(screenW * (844 / 390))
  const islandW = Math.round(screenW * 0.3)
  const islandH = Math.round(screenW * 0.085)
  const islandTop = Math.round(screenW * 0.03)
  const buttonW = Math.max(2, Math.round(width * 0.012))
  const metal = "linear-gradient(180deg, #7a726d, #3a3532 40%, #26221f)"

  return (
    <div className={className} style={{ width, position: "relative", ...style }}>
      {/* Side buttons */}
      <span aria-hidden="true" style={{ position: "absolute", left: -buttonW, top: screenH * 0.16, width: buttonW, height: width * 0.07, borderRadius: 2, background: metal }} />
      <span aria-hidden="true" style={{ position: "absolute", left: -buttonW, top: screenH * 0.26, width: buttonW, height: width * 0.13, borderRadius: 2, background: metal }} />
      <span aria-hidden="true" style={{ position: "absolute", left: -buttonW, top: screenH * 0.26 + width * 0.16, width: buttonW, height: width * 0.13, borderRadius: 2, background: metal }} />
      <span aria-hidden="true" style={{ position: "absolute", right: -buttonW, top: screenH * 0.3, width: buttonW, height: width * 0.2, borderRadius: 2, background: metal }} />

      {/* Titanium band */}
      <div
        style={{
          borderRadius: radius,
          padding: band,
          background: "linear-gradient(160deg, #8a827c 0%, #3b3633 30%, #1c1917 62%, #5a534e 100%)",
          boxShadow: "0 40px 80px -28px oklch(0 0 0 / 0.5), 0 12px 28px -12px oklch(0 0 0 / 0.35), 0 0 0 0.5px oklch(0 0 0 / 0.35)",
        }}
      >
        {/* Bezel */}
        <div style={{ borderRadius: radius - band, padding: bezel, background: "#070606" }}>
          {/* Screen */}
          <div className="relative overflow-hidden" style={{ width: screenW, height: screenH, borderRadius: radius - band - bezel, background: screenBackground }}>
            {/* Island */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full"
              style={{ top: islandTop, width: islandW, height: islandH, background: "#000" }}
            >
              <span className="absolute top-1/2 -translate-y-1/2 rounded-full" style={{ right: islandH * 0.32, width: islandH * 0.36, height: islandH * 0.36, background: "#161418", boxShadow: "inset 0 0 0 1px #2a2530" }} />
            </div>

            {/* Status bar */}
            {status && (
              <div className="absolute inset-x-0 z-30 flex items-center justify-between" style={{ top: islandTop, height: islandH, paddingInline: screenW * 0.085, color: statusColor }}>
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
