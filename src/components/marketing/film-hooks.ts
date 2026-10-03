"use client"

import { useSpring, useTransform, type MotionValue } from "motion/react"
import type { Fade, Move } from "./film-timeline"
import { SPRING_LIGHT } from "./tokens"

type Spring = { stiffness: number; damping: number; mass: number }

/** An opacity that rises over `[a, b]`, holds, and falls over `[c, d]`.
 *  Sprung, so a wheel notch never completes a fade in one frame. */
export function useFade(p: MotionValue<number>, fade: Fade, spring: Spring = SPRING_LIGHT) {
  return useSpring(useTransform(p, [...fade], [0, 1, 1, 0]), spring)
}

/** A value travelling from `from` to `to` over `move`, sprung. */
export function useMove(p: MotionValue<number>, move: Move, from: number, to: number, spring: Spring = SPRING_LIGHT) {
  return useSpring(useTransform(p, [...move], [from, to]), spring)
}

/** Anything that fades out must also leave the accessibility tree and the
 *  tab order: opacity alone keeps invisible links focusable and invisible
 *  text readable. `visibility` follows the opacities. */
export function useVisibility(...opacities: MotionValue<number>[]) {
  return useTransform(opacities, (values: number[]) => (values.some((v) => v > 0.02) ? "visible" : "hidden"))
}

/** A caption: the title rises in, holds, rises out; the paragraph follows
 *  by `lag`. Both leave the tree together while invisible. */
export function useCaption(p: MotionValue<number>, fade: Fade, lag: number) {
  const [a, b, c, d] = fade
  const lagged: Fade = [a + lag, b + lag, c, d]
  const title = { o: useFade(p, fade), y: useSpring(useTransform(p, [...fade], [28, 0, 0, -22]), SPRING_LIGHT) }
  const body = { o: useFade(p, lagged), y: useSpring(useTransform(p, [...lagged], [28, 0, 0, -22]), SPRING_LIGHT) }
  return { title, body, visibility: useVisibility(title.o, body.o) }
}
