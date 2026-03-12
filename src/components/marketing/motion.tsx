"use client"

import { type ReactNode, useRef } from "react"
import { motion, useInView, type Variant } from "motion/react"

/* ─── Scroll-triggered fade-in ────────────────────────────────────── */

type FadeInProps = {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  direction?: "up" | "down" | "left" | "right" | "none"
  distance?: number
  once?: boolean
  amount?: number
}

const directionMap: Record<string, (d: number) => { x: number; y: number }> = {
  up: (d) => ({ x: 0, y: d }),
  down: (d) => ({ x: 0, y: -d }),
  left: (d) => ({ x: d, y: 0 }),
  right: (d) => ({ x: -d, y: 0 }),
  none: () => ({ x: 0, y: 0 }),
}

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.6,
  direction = "up",
  distance = 30,
  once = true,
  amount = 0.3,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, amount })

  const offset = directionMap[direction](distance)

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      animate={
        isInView
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: 0, x: offset.x, y: offset.y }
      }
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  )
}

/* ─── Staggered children container ────────────────────────────────── */

type StaggerProps = {
  children: ReactNode
  className?: string
  stagger?: number
  delay?: number
  once?: boolean
  amount?: number
}

const containerVariants = (stagger: number, delay: number) => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: stagger,
      delayChildren: delay,
    },
  },
})

const itemVariants: Record<string, Variant> = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  },
}

export function Stagger({
  children,
  className,
  stagger = 0.1,
  delay = 0,
  once = true,
  amount = 0.2,
}: StaggerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, amount })

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={containerVariants(stagger, delay)}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}

/* ─── Scale-in on scroll ──────────────────────────────────────────── */

export function ScaleIn({
  children,
  className,
  delay = 0,
  duration = 0.7,
  once = true,
}: {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  once?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, amount: 0.3 })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={
        isInView
          ? { opacity: 1, scale: 1 }
          : { opacity: 0, scale: 0.95 }
      }
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
