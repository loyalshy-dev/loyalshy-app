// The landing's shared constants. Colours mirror the `[data-brand]` tokens
// in globals.css for the places that need a literal (SVG fills, the pass
// renderer); springs are the two weights every scroll-driven stage uses.

/** Ink — the brand's text colour, and the demo pass's ground. */
export const INK = "#1F1410"
/** Coral — the one accent. */
export const CORAL = "#FF6B47"

/** Heavy things (the phone, the map, a pass) settle slowly. */
export const SPRING_HEAVY = { stiffness: 70, damping: 22, mass: 1 }
/** Light things (text, banners, side cards) answer quickly. */
export const SPRING_LIGHT = { stiffness: 110, damping: 24, mass: 0.6 }
