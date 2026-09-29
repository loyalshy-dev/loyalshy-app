"use client"

import { useRef } from "react"
import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react"
import { useTranslations } from "next-intl"
import { WalletPassRenderer, type WalletPassDesign } from "@/components/wallet-pass-renderer"
import { DEMO_PASS_DESIGN, DEMO_PASS_LOGO, DEMO_PASS_TOTAL } from "./demo-pass"
import { SectionHeading } from "./section-heading"
import { useMediaQuery } from "./use-media-query"

// "Made with Loyalshy": the anatomy of the two cards, told by scroll. The
// stamp card settles into place and its parts are called out one by one —
// logo, stamps, next reward, name, QR. Then the card turns over into a
// coupon and its parts get the same treatment. Both cards are the product's
// own renderer, so the callouts point at real layout, not a picture.

const INK = "#1F1410"
const CORAL = "#FF6B47"
const SPRING = { stiffness: 110, damping: 24, mass: 0.6 }
const HEAVY = { stiffness: 70, damping: 22, mass: 1 }
const PIN_VH = 540

// Callout targets as fractions of the Apple pass (320 × 450)
type Part = { key: string; side: "left" | "right"; tx: number; ty: number }
const STAMP_PARTS: Part[] = [
  { key: "logo", side: "left", tx: 0.16, ty: 0.065 },
  { key: "stamps", side: "right", tx: 0.62, ty: 0.27 },
  { key: "reward", side: "left", tx: 0.14, ty: 0.49 },
  { key: "name", side: "right", tx: 0.88, ty: 0.49 },
  { key: "qr", side: "left", tx: 0.5, ty: 0.8 },
]
const COUPON_PARTS: Part[] = [
  { key: "offer", side: "right", tx: 0.5, ty: 0.3 },
  { key: "valid", side: "left", tx: 0.16, ty: 0.49 },
  { key: "code", side: "right", tx: 0.5, ty: 0.49 },
  { key: "qr", side: "left", tx: 0.5, ty: 0.8 },
]

const COUPON_DESIGN: WalletPassDesign = {
  ...DEMO_PASS_DESIGN,
  cardType: "COUPON",
  useStampGrid: false,
  fields: ["organization", "discount", "validUntil", "couponCode", "customerName"],
}

// Each callout owns a window of progress; label and line arrive together.
function useCallout(p: MotionValue<number>, start: number) {
  const o = useSpring(useTransform(p, [start, start + 0.06], [0, 1]), SPRING)
  const x = useSpring(useTransform(p, [start, start + 0.07], [10, 0]), SPRING)
  const draw = useSpring(useTransform(p, [start, start + 0.08], [0, 1]), { stiffness: 80, damping: 22, mass: 0.8 })
  return { o, x, draw }
}

function Callouts({ parts, p, start, cardW, boxW, boxH, t, ns, narrow }: { parts: Part[]; p: MotionValue<number>; start: number; cardW: number; boxW: number; boxH: number; t: ReturnType<typeof useTranslations>; ns: string; narrow: boolean }) {
  const cardH = Math.round(cardW * (450 / 320))
  const cardX = (boxW - cardW) / 2
  const cardY = narrow ? 0 : (boxH - cardH) / 2
  const labelW = 150
  // hooks must run in a stable order: one per part
  const c0 = useCallout(p, start)
  const c1 = useCallout(p, start + 0.075)
  const c2 = useCallout(p, start + 0.15)
  const c3 = useCallout(p, start + 0.225)
  const c4 = useCallout(p, start + 0.3)
  const cs = [c0, c1, c2, c3, c4]
  if (narrow) {
    return (
      <ul className="absolute inset-x-0 flex flex-col gap-1.5 text-center" style={{ top: cardH + 18 }}>
        {parts.map((part, i) => (
          <motion.li key={part.key} style={{ opacity: cs[i].o, y: cs[i].x }} className="mk-body-sm flex items-center justify-center gap-2">
            <span className="size-1.5 rounded-full" style={{ background: CORAL }} aria-hidden="true" />
            <span style={{ color: "var(--mk-text)" }}>{t(`${ns}.parts.${part.key}`)}</span>
          </motion.li>
        ))}
      </ul>
    )
  }
  return (
    <>
      <svg className="pointer-events-none absolute inset-0" width={boxW} height={boxH} viewBox={`0 0 ${boxW} ${boxH}`} aria-hidden="true">
        {parts.map((part, i) => {
          const tx = cardX + part.tx * cardW
          const ty = cardY + part.ty * cardH
          const lx = part.side === "left" ? labelW : boxW - labelW
          const ly = cardY + part.ty * cardH
          return (
            <g key={part.key}>
              <motion.line x1={lx} y1={ly} x2={tx} y2={ty} stroke={INK} strokeWidth="1" strokeOpacity="0.5" style={{ pathLength: cs[i].draw, opacity: cs[i].o }} />
              <motion.circle cx={tx} cy={ty} r="4" fill={CORAL} style={{ scale: cs[i].draw, opacity: cs[i].o }} />
            </g>
          )
        })}
      </svg>
      {parts.map((part, i) => (
        <motion.p
          key={part.key}
          style={{ opacity: cs[i].o, x: cs[i].x, top: cardY + part.ty * cardH, [part.side === "left" ? "left" : "right"]: 0, width: labelW - 14 }}
          className={`absolute -translate-y-1/2 text-[13px] leading-snug ${part.side === "left" ? "text-right" : "text-left"}`}
        >
          <span style={{ color: "var(--mk-text)" }}>{t(`${ns}.parts.${part.key}`)}</span>
        </motion.p>
      ))}
    </>
  )
}

function StampCard({ w, t }: { w: number; t: ReturnType<typeof useTranslations> }) {
  return (
    <WalletPassRenderer
      design={DEMO_PASS_DESIGN}
      format="apple"
      compact
      width={w}
      logoUrl={DEMO_PASS_LOGO}
      organizationName={t("card.business")}
      programName={t("card.program")}
      currentVisits={4}
      totalVisits={DEMO_PASS_TOTAL}
      rewardDescription={t("card.reward")}
      customerName={t("card.customer")}
      memberNumber="42"
      height={Math.round(w * (450 / 320))}
      style={{ boxShadow: "0 30px 60px -24px oklch(0 0 0 / 0.45)" }}
    />
  )
}

function CouponCard({ w, t, tc }: { w: number; t: ReturnType<typeof useTranslations>; tc: ReturnType<typeof useTranslations> }) {
  return (
    <WalletPassRenderer
      design={COUPON_DESIGN}
      format="apple"
      compact
      width={w}
      logoUrl={DEMO_PASS_LOGO}
      organizationName={t("card.business")}
      programName={tc("coupon.name")}
      customerName={t("card.customer")}
      discountText={tc("coupon.offer")}
      validUntil={tc("coupon.validUntil")}
      couponCode={tc("coupon.code")}
      height={Math.round(w * (450 / 320))}
      style={{ boxShadow: "0 30px 60px -24px oklch(0 0 0 / 0.45)" }}
    />
  )
}

function Anatomy() {
  const t = useTranslations("hero")
  const tc = useTranslations("gallery")
  const narrow = useMediaQuery("(max-width: 1023px)")
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] })

  const cardW = narrow ? 200 : 300
  const boxW = narrow ? 340 : 620
  const boxH = narrow ? Math.round(200 * (450 / 320)) + 170 : 500

  // The stamp card settles, holds, then turns over into the coupon.
  const stampRotate = useSpring(useTransform(p, [0, 0.1, 0.5, 0.58], [-22, 0, 0, -90]), HEAVY)
  const stampScale = useSpring(useTransform(p, [0, 0.1], [0.92, 1]), HEAVY)
  const stampVis = useTransform(p, [0.575, 0.58], [1, 0])
  const couponRotate = useSpring(useTransform(p, [0.58, 0.66], [90, 0]), HEAVY)
  const couponVis = useTransform(p, [0.575, 0.58], [0, 1])

  const nameA = { o: useSpring(useTransform(p, [0.02, 0.09, 0.48, 0.55], [0, 1, 1, 0]), SPRING), y: useSpring(useTransform(p, [0.02, 0.09, 0.48, 0.55], [20, 0, 0, -16]), SPRING) }
  const nameB = { o: useSpring(useTransform(p, [0.63, 0.7], [0, 1]), SPRING), y: useSpring(useTransform(p, [0.63, 0.7], [20, 0]), SPRING) }

  const card = (
    <div className="relative" style={{ width: cardW, height: Math.round(cardW * (450 / 320)), perspective: 1400 }}>
      <motion.div style={{ rotateY: stampRotate, scale: stampScale, opacity: stampVis, transformStyle: "preserve-3d" }} className="absolute inset-0">
        <StampCard w={cardW} t={t} />
      </motion.div>
      <motion.div style={{ rotateY: couponRotate, opacity: couponVis, transformStyle: "preserve-3d" }} className="absolute inset-0">
        <CouponCard w={cardW} t={t} tc={tc} />
      </motion.div>
    </div>
  )

  return (
    <div ref={ref} className="relative" style={{ height: `${PIN_VH}vh` }}>
      <div className="sticky overflow-hidden" style={{ top: "var(--mk-bar-h, 48px)", height: "calc(100svh - var(--mk-bar-h, 48px))" }}>
        <div className="mk-wrap relative h-full">
          {/* Title + the act */}
          <div className="absolute inset-x-0 top-8 text-center lg:left-10 lg:right-auto lg:top-1/2 lg:w-4/12 lg:-translate-y-1/2 lg:text-left">
            <SectionHeading title={tc("title")} align={narrow ? "center" : "left"} />
            <div className="relative mt-4 h-[5.5rem] lg:mt-6">
              {[{ k: "stamp", m: nameA }, { k: "coupon", m: nameB }].map(({ k, m }) => (
                <motion.div key={k} style={{ opacity: m.o, y: m.y }} className="absolute inset-x-0 top-0">
                  <p className="mk-title-4" style={{ color: "var(--mk-text)" }}>{tc(`${k}.name`)}</p>
                  <p className="mk-body-sm mx-auto mt-1 max-w-[36ch] lg:mx-0" style={{ color: "var(--mk-text-muted)" }}>{tc(`${k}.lead`)}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* The card and its callouts */}
          <div
            className="absolute left-1/2 -translate-x-1/2 lg:left-auto lg:right-0 lg:top-1/2 lg:translate-x-0 lg:-translate-y-1/2"
            style={{ width: boxW, height: boxH, top: narrow ? 236 : undefined }}
          >
            <div className={narrow ? "absolute left-1/2 top-0 -translate-x-1/2" : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"}>{card}</div>
            <motion.div style={{ opacity: stampVis }} className="absolute inset-0">
              <Callouts parts={STAMP_PARTS} p={p} start={0.13} cardW={cardW} boxW={boxW} boxH={boxH} t={tc} ns="stamp" narrow={narrow} />
            </motion.div>
            <motion.div style={{ opacity: couponVis }} className="absolute inset-0">
              <Callouts parts={COUPON_PARTS} p={p} start={0.7} cardW={cardW} boxW={boxW} boxH={boxH} t={tc} ns="coupon" narrow={narrow} />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Reduced motion: both cards with their parts listed ───────────── */

function Static() {
  const t = useTranslations("hero")
  const tc = useTranslations("gallery")
  const w = 240
  return (
    <div className="mk-wrap py-20 lg:py-28">
      <SectionHeading title={tc("title")} align="center" />
      <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-8">
        {[{ k: "stamp", parts: STAMP_PARTS, node: <StampCard w={w} t={t} /> }, { k: "coupon", parts: COUPON_PARTS, node: <CouponCard w={w} t={t} tc={tc} /> }].map((act) => (
          <figure key={act.k} className="flex flex-col items-center gap-6 text-center">
            {act.node}
            <figcaption>
              <p className="mk-title-4" style={{ color: "var(--mk-text)" }}>{tc(`${act.k}.name`)}</p>
              <ul className="mk-body-sm mt-2 flex flex-col gap-1" style={{ color: "var(--mk-text-muted)" }}>
                {act.parts.map((part) => (
                  <li key={part.key}>{tc(`${act.k}.parts.${part.key}`)}</li>
                ))}
              </ul>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

export function CardAnatomy() {
  const reduced = useReducedMotion()
  return (
    <section id="cards" className="scroll-mt-24" style={{ background: "var(--mk-bg)" }}>
      {reduced ? <Static /> : <Anatomy />}
    </section>
  )
}
