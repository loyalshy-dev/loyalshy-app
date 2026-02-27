/* ─── Shared card data for marketing wallet visuals ───────────────── */

export interface CardData {
  restaurant: string
  monogram: string
  primary: string
  secondary: string
  visits: number
  total: number
  reward: string
}

export const CARDS: CardData[] = [
  {
    restaurant: "Blue Horizon Bistro",
    monogram: "BH",
    primary: "#023e8a",
    secondary: "#48cae4",
    visits: 7,
    total: 10,
    reward: "Free dessert",
  },
  {
    restaurant: "Rosetta Kitchen",
    monogram: "RK",
    primary: "#e63946",
    secondary: "#f1a7a0",
    visits: 3,
    total: 8,
    reward: "Free appetizer",
  },
  {
    restaurant: "Fern & Root",
    monogram: "FR",
    primary: "#1b4332",
    secondary: "#52b788",
    visits: 5,
    total: 12,
    reward: "BOGO entrée",
  },
  {
    restaurant: "Violet Table",
    monogram: "VT",
    primary: "#4a148c",
    secondary: "#ce93d8",
    visits: 9,
    total: 10,
    reward: "Free meal",
  },
  {
    restaurant: "Ember & Oak",
    monogram: "EO",
    primary: "#3e2723",
    secondary: "#a1887f",
    visits: 2,
    total: 6,
    reward: "Free espresso",
  },
]

/* ─── Decorative QR pattern ────────────────────────────────────────── */

/** Seeded PRNG so each card gets a stable, unique QR pattern. */
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return s / 2147483647
  }
}

/** 9×9 grid with corner finder patterns baked in — looks like a real QR code. */
function generateQrGrid(seed: number): boolean[][] {
  const size = 9
  const rand = seededRandom(seed)
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => rand() > 0.45),
  )

  // Top-left finder pattern (3×3 solid block)
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) grid[r][c] = true
  // Top-right finder
  for (let r = 0; r < 3; r++)
    for (let c = size - 3; c < size; c++) grid[r][c] = true
  // Bottom-left finder
  for (let r = size - 3; r < size; r++)
    for (let c = 0; c < 3; c++) grid[r][c] = true

  return grid
}

// Pre-generate grids (one per card) so they're stable across renders.
export const QR_GRIDS = CARDS.map((_, i) => generateQrGrid((i + 1) * 7919))
