"use client"

import { motion, useSpring, useTransform, type MotionValue } from "motion/react"
import { CardFace, DoorStickerArt, ReviewsCardArt, type MockCopy } from "./pages/promote-pieces"
import { FILM } from "./film-timeline"
import { SPRING_LIGHT } from "./tokens"

// Chapter 1: how a program gets in front of customers, as the counter
// pieces from /promote floating around the phone while the counter QR is
// in the camera — the door sticker, the counter card and the reviews card
// (2026-10-04; they replaced email + social-network tiles). Positions are
// in phone widths from the phone's centre; sizes too. Two pieces in the
// gutters on phones, three on desktop. Each rises in a beat after the
// one before.

type Piece = { key: "door" | "card" | "reviews"; wide: readonly [number, number]; narrow: readonly [number, number] | null; width: number; narrowWidth: number; delay: number }

const PIECES: Piece[] = [
  // On phones the gutter is ~0.3 phone widths, so the pieces are smaller and
  // sit on the phone's edge rather than beside it.
  { key: "door", wide: [-0.95, -0.42], narrow: [-0.6, -0.42], width: 0.5, narrowWidth: 0.38, delay: 0 },
  { key: "card", wide: [0.78, 0.12], narrow: [0.62, 0.3], width: 0.44, narrowWidth: 0.34, delay: 1 },
  { key: "reviews", wide: [-0.92, 0.62], narrow: null, width: 0.62, narrowWidth: 0, delay: 2 },
]

function usePiece(p: MotionValue<number>, i: number) {
  const [inStart, inEnd, outStart, outEnd] = FILM.ch1.camera
  const start = inStart + i * FILM.ch1.tileStep * 2
  const o = useSpring(useTransform(p, [start, start + (inEnd - inStart), outStart, outEnd], [0, 1, 1, 0]), SPRING_LIGHT)
  const y = useSpring(useTransform(p, [start, start + (inEnd - inStart) * 1.6], [18, 0]), { stiffness: 120, damping: 16, mass: 0.8 })
  const visibility = useTransform(o, (v) => (v > 0.01 ? "visible" : "hidden"))
  return { o, y, visibility }
}

export function ShareTiles({ p, narrow, mock }: { p: MotionValue<number>; narrow: boolean; mock: MockCopy }) {
  // One hook call per piece, in a fixed order.
  const motions = [usePiece(p, PIECES[0].delay), usePiece(p, PIECES[1].delay), usePiece(p, PIECES[2].delay)]
  return (
    <>
      {PIECES.map((piece, i) => {
        const pos = narrow ? piece.narrow : piece.wide
        if (!pos) return null
        const [dx, dy] = pos
        // `--pw` is the phone's width (CSS); the wrapper is a size container
        // and each piece is drawn in container units, so it scales with it.
        const w = `calc(var(--pw) * ${narrow ? piece.narrowWidth : piece.width})`
        return (
          <motion.div
            key={piece.key}
            style={{
              opacity: motions[i].o,
              y: motions[i].y,
              visibility: motions[i].visibility,
              left: `calc(50% + var(--pw) * ${dx})`,
              top: `calc(50% + var(--pw) * ${dy})`,
              width: w,
              rotate: piece.key === "card" ? 4 : piece.key === "door" ? -6 : 3,
            }}
            className="mk-film-piece pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          >
            {piece.key === "door" ? <DoorStickerArt m={mock} size="100cqw" /> : null}
            {piece.key === "card" ? <CardFace m={mock} width="100cqw" /> : null}
            {piece.key === "reviews" ? <ReviewsCardArt m={mock} width="100cqw" /> : null}
          </motion.div>
        )
      })}
    </>
  )
}
