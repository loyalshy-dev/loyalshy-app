// The counter-material quote request (/promote): the pieces and quantity
// options, shared by the form and its server action so the two can't drift.
export const MATERIAL_PIECES = ["counterCard", "tableTent", "doorSticker", "windowSticker", "stamp", "social", "other"] as const
export type MaterialPiece = (typeof MATERIAL_PIECES)[number]
export const MATERIAL_QUANTITIES = ["1", "2-5", "6-10", "more"] as const
export type MaterialQuantity = (typeof MATERIAL_QUANTITIES)[number]
