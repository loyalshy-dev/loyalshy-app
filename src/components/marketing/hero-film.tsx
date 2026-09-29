"use client"

import { useRef, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react"
import { useTranslations } from "next-intl"
import { MapScene } from "./map-scene"
import { PhoneFrame } from "./phone-frame"
import { useMediaQuery } from "./use-media-query"

// The hero film: one phone, three chapters, scroll as the only clock.
//   1. The card on their phone — the counter QR is scanned, the pass slides
//      into Wallet; an envelope beside the phone says it also comes by email.
//   2. It shows up when they are nearby — lock screen, a ring grows from the
//      business and the proximity banner drops in when the ring reaches it.
//   3. Reach them all with one message — the owner writes the notice in the
//      dashboard, it flies to the phone and lands as a notification, two
//      faint phones behind say it reached everyone.
// The stage is pinned for about four screens; every scroll position is a readable
// state. Rotation stays under 20° so the screen stays legible. Only
// transform and opacity animate. Reduced motion gets three static frames.

const INK = "#1F1410"
// Two weights: the phone, the map and the pass are heavy and settle slowly;
// text, banners and side cards are light and answer quickly. Opacities go
// through a spring too, so a wheel notch never completes a fade in one frame.
const HEAVY = { stiffness: 70, damping: 22, mass: 1 }
const LIGHT = { stiffness: 110, damping: 24, mass: 0.6 }
// How long the stage stays pinned, in viewport heights. The story plays over
// (PIN_VH − 100)vh of scroll, so 760 gives ~6.6 screens: about a screen and
// a half per chapter, with a breath between chapters where only the phone is on. Raise it to slow the film down, lower to speed up.
const PIN_VH = 760

// Real artefacts from a client's phone, cropped: two Wallet notifications
// (proximity and announcement), the pass itself, and its logo. They carry
// their own name and text, so they are not translated.
function RealBanner({ src, height, alt }: { src: string; height: number; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1080}
      height={height}
      className="h-auto w-full rounded-[18px]"
      style={{ boxShadow: "0 8px 24px oklch(0 0 0 / 0.22)" }}
      sizes="300px"
    />
  )
}

function RealPass({ alt }: { alt: string }) {
  return (
    <Image
      src="/hero/real-pass.webp"
      alt={alt}
      width={720}
      height={1003}
      className="h-auto w-full rounded-[10px]"
      style={{ boxShadow: "0 14px 34px oklch(0 0 0 / 0.22)" }}
      sizes="300px"
    />
  )
}

// The one banner we have no photo of (the reward) is built from the real
// pass's logo and thumbnail, laid out as iOS lays it out.
function RewardBanner({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[20px] py-2.5 pl-3 pr-2.5"
      style={{ background: "oklch(0.2 0.01 285 / 0.86)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", boxShadow: "0 8px 24px oklch(0 0 0 / 0.22)" }}
    >
      <Image src="/hero/real-logo.webp" alt="" width={38} height={38} className="size-[38px] shrink-0 rounded-[9px]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-[1.2] text-white">{title}</p>
        <p className="text-[13px] leading-[1.25]" style={{ color: "oklch(0.92 0 0)" }}>{body}</p>
      </div>
      <Image src="/hero/real-pass.webp" alt="" width={40} height={56} className="h-[56px] w-[40px] shrink-0 rounded-[3px] object-cover" aria-hidden="true" />
    </div>
  )
}

// The lock screen as iOS lays it out: date and time up top, the flashlight
// and camera buttons in the bottom corners, the home indicator under them.
// Notifications land just above the buttons.
const LOCK_BOTTOM = 92 // where a notification's bottom edge sits

function LockFace({ date, narrow }: { date: string; narrow: boolean }) {
  const btn = "absolute bottom-[34px] grid size-11 place-items-center rounded-full"
  const btnStyle = { background: "oklch(0.2 0.01 40 / 0.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, oklch(0.94 0.01 60) 0%, oklch(0.86 0.02 50) 100%)" }}>
      <div className={narrow ? "pt-12 text-center" : "pt-14 text-center"} style={{ color: INK }}>
        <p className="text-[13px] font-medium">{date}</p>
        <p className={narrow ? "font-display text-[54px] font-bold leading-none tracking-tight" : "font-display text-[64px] font-bold leading-none tracking-tight"}>9:41</p>
      </div>
      {/* Flashlight */}
      <div className={`${btn} left-[30px]`} style={btnStyle} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3h8v3l-2 3v11a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V9L8 6Z" />
          <path d="M8 6h8" />
          <circle cx="12" cy="13" r="1" fill="#fff" stroke="none" />
        </svg>
      </div>
      {/* Camera */}
      <div className={`${btn} right-[30px]`} style={btnStyle} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
          <circle cx="12" cy="13" r="3.2" />
        </svg>
      </div>
      {/* Home indicator */}
      <div aria-hidden="true" className="absolute bottom-2 left-1/2 h-[5px] w-[34%] -translate-x-1/2 rounded-full" style={{ background: INK, opacity: 0.85 }} />
    </div>
  )
}

/* ─── The pinned film ─────────────────────────────────────────────── */

function Film({ qr, demoUrl, tent }: { qr: string; demoUrl?: string; tent?: ReactNode }) {
  const t = useTranslations("hero")
  const tDemo = useTranslations("tryDemo")
  const narrow = useMediaQuery("(max-width: 1023px)")
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] })

  // A fade that a scroll notch can't finish in one frame.
  const useFade = (keys: number[], values: number[]) => useSpring(useTransform(p, keys, values), LIGHT)

  const phoneW = narrow ? 230 : 300

  // The phone as an object. Rotation is skipped on phones (touch GPUs).
  const rot = narrow ? 0 : 1
  const rotateY = useSpring(useTransform(p, [0, 0.08, 0.24, 0.42, 0.5, 0.72, 0.8, 0.96, 1], [0, -18 * rot, 0, 0, 12 * rot, 12 * rot, 0, 0, 0]), HEAVY)
  const rotateX = useSpring(useTransform(p, [0, 0.24, 0.5, 0.8, 0.96], [0, 4 * rot, -3 * rot, 0, 0]), HEAVY)
  const scale = useSpring(useTransform(p, [0, 0.08, 0.24, 0.42, 0.5, 0.72, 0.8, 0.93, 1], [1, 1, 1.1, 1.1, 1.04, 1.04, 0.92, 0.92, 0.98]), HEAVY)
  // On desktop the phone opens centered on the stage and slides over to the
  // right as the first caption arrives, then drifts a little further whenever
  // a card sits beside it.
  const shift = narrow ? 0 : 240
  const side = narrow ? 0 : 56
  const x = useSpring(useTransform(p, [0, 0.1, 0.26, 0.42, 0.5, 0.72, 0.8, 0.93, 0.99], narrow ? [0, 0, 0, 0, 0, 0, 0, 0, 0] : [0, shift, shift + side, shift + side, shift - 30, shift - 30, shift + side, shift + side, 0]), HEAVY)

  // Screen layers
  const lockOpacity = useFade([0, 0.06, 0.12, 0.36, 0.42, 0.94, 0.96], [1, 1, 0, 0, 1, 1, 0])
  const cameraOpacity = useFade([0.06, 0.12, 0.2, 0.26], [0, 1, 1, 0])
  const scanFrame = useSpring(useTransform(p, [0.1, 0.2], [1.15, 1]), HEAVY)
  const walletOpacity = useFade([0.2, 0.26, 0.36, 0.42], [0, 1, 1, 0])
  const passY = useSpring(useTransform(p, [0.22, 0.34], [380, 0]), HEAVY)

  // Chapter 1: the table tent on the counter (what the camera is scanning),
  // then the envelope under it
  const tentOpacity = useFade([0.08, 0.16, 0.36, 0.42], [0, 1, 1, 0])
  const tentX = useSpring(useTransform(p, [0.08, 0.16], [-24, 0]), LIGHT)
  const mailOpacity = useFade([0.28, 0.34, 0.36, 0.42], [0, 1, 1, 0])
  const mailX = useSpring(useTransform(p, [0.28, 0.34], [-24, 0]), LIGHT)

  // Chapter 2: the map behind the phone, the customer walking into the
  // fence, the pulse when they cross it, then the banner
  const mapOpacity = useFade([0.46, 0.54, 0.7, 0.76], [0, 1, 1, 0])
  const mapY = useSpring(useTransform(p, [0.46, 0.56], [30, 0]), HEAVY)
  const walk = useSpring(useTransform(p, [0.5, 0.64], [0, 1]), { stiffness: 60, damping: 22, mass: 1 })
  const pulse = useTransform(p, [0.62, 0.7], [0, 1])
  const nearY = useSpring(useTransform(p, [0.63, 0.69], [28, 0]), LIGHT)
  const nearOpacity = useFade([0.63, 0.68, 0.72, 0.76], [0, 1, 1, 0])

  // Chapter 3: the dashboard card, the message in flight, the banner, the crowd
  const cardOpacity = useFade([0.79, 0.85, 0.92, 0.95], [0, 1, 1, 0])
  const cardX = useSpring(useTransform(p, [0.79, 0.85], [-24, 0]), LIGHT)
  const flyX = useSpring(useTransform(p, [0.85, 0.9], [narrow ? 0 : -220, 0]), LIGHT)
  const flyY = useSpring(useTransform(p, [0.85, 0.9], [narrow ? 120 : 40, -140]), LIGHT)
  const flyOpacity = useFade([0.845, 0.86, 0.89, 0.905], [0, 1, 1, 0])
  const announceY = useSpring(useTransform(p, [0.89, 0.93], [24, 0]), LIGHT)
  const announceOpacity = useFade([0.89, 0.92, 0.935, 0.955], [0, 1, 1, 0])
  const crowdOpacity = useFade([0.89, 0.92, 0.935, 0.955], [0, 1, 1, 0])
  const crowdSpread = useSpring(useTransform(p, [0.89, 0.93], [0, 1]), HEAVY)
  const crowdLeft = useTransform(crowdSpread, (v) => -110 * v)
  const crowdRight = useTransform(crowdSpread, (v) => 110 * v)

  // The exit: the pass returns with four stamps, the fifth lands, the reward
  // banner drops in, and the phone is back at the centre when the stage lets go.
  const wallet2Opacity = useFade([0.955, 0.97], [0, 1])
  const pass2Y = useSpring(useTransform(p, [0.955, 0.975], [320, 0]), HEAVY)
  const rewardY = useSpring(useTransform(p, [0.978, 0.995], [-40, 0]), LIGHT)
  const rewardOpacity = useFade([0.978, 0.992], [0, 1])
  const tryOpacity = useFade([0.985, 1], [0, 1])
  const tryY = useSpring(useTransform(p, [0.985, 1], [16, 0]), LIGHT)
  const tryEvents = useTransform(p, (v) => (v > 0.99 ? "auto" : "none"))

  // Captions: each one rises in, holds, and rises out; the paragraph
  // follows the title by a beat.
  const useCaption = (a: number, b: number, c: number, d: number, lag = 0) => ({
    o: useSpring(useTransform(p, [a + lag, b + lag, c, d], [0, 1, 1, 0]), LIGHT),
    y: useSpring(useTransform(p, [a + lag, b + lag, c, d], [28, 0, 0, -22]), LIGHT),
  })
  const c1t = useCaption(0.07, 0.14, 0.34, 0.41)
  const c1p = useCaption(0.07, 0.14, 0.34, 0.41, 0.02)
  const c2t = useCaption(0.47, 0.54, 0.68, 0.75)
  const c2p = useCaption(0.47, 0.54, 0.68, 0.75, 0.02)
  const c3t = useCaption(0.8, 0.87, 0.92, 0.96)
  const c3p = useCaption(0.8, 0.87, 0.92, 0.96, 0.02)
  const c4t = useCaption(0.965, 0.99, 1.5, 1.6)
  const c4p = useCaption(0.965, 0.99, 1.5, 1.6, 0.02)
  const intro = useFade([0, 0.07], [1, 0])

  // Announce which chapter is on for assistive tech.
  const liveRef = useRef<HTMLParagraphElement>(null)
  useMotionValueEvent(p, "change", (v) => {
    const el = liveRef.current
    if (!el) return
    const next = v < 0.08 ? "" : v < 0.44 ? t("film.ch1.title") : v < 0.78 ? t("film.ch2.title") : v < 0.96 ? t("film.ch3.title") : t("film.ch4.title")
    if (el.textContent !== next) el.textContent = next
  })

  const captions = [
    { key: "ch1", t: c1t, p: c1p },
    { key: "ch2", t: c2t, p: c2p },
    { key: "ch3", t: c3t, p: c3p },
    { key: "ch4", t: c4t, p: c4p },
  ] as const

  return (
    <div ref={ref} className="relative" style={{ height: `${PIN_VH}vh` }}>
      <div className="sticky overflow-hidden" style={{ top: "var(--mk-bar-h, 48px)", height: "calc(100svh - var(--mk-bar-h, 48px))" }}>
        <p ref={liveRef} className="sr-only" aria-live="polite" />
        <div className="mk-wrap relative h-full">
          {/* Captions: under the phone on phones, on the left axis on desktop */}
          <div className="absolute inset-x-0 bottom-3 h-[14rem] lg:inset-x-auto lg:bottom-auto lg:left-10 lg:top-1/2 lg:h-auto lg:w-5/12 lg:-translate-y-1/2">
            <motion.p style={{ opacity: intro }} className="mk-lead absolute inset-x-0 top-0 text-center lg:hidden">
              {t("film.scroll")}
            </motion.p>
            {captions.map((c) => (
              <div key={c.key} className="absolute inset-x-0 top-0 text-center lg:text-left">
                <motion.h2 style={{ opacity: c.t.o, y: c.t.y }} className={c.key === "ch4" ? "font-display mk-display-2 lg:max-w-[13ch]" : "font-display mk-display-2 lg:max-w-[14ch]"}>
                  <span style={{ color: "var(--mk-text)" }}>{t(`film.${c.key}.title`)}</span>
                </motion.h2>
                {c.key !== "ch4" && (
                  <motion.p style={{ opacity: c.p.o, y: c.p.y }} className="mk-lead mx-auto mt-3 max-w-[40ch] lg:mx-0 lg:mt-4">
                    {t(`film.${c.key}.caption`)}
                  </motion.p>
                )}
                {c.key === "ch4" && demoUrl && (
                  <motion.div style={{ opacity: tryOpacity, y: tryY, pointerEvents: tryEvents }} className="mt-4 lg:mt-6">
                    <p className="mk-body-sm mx-auto max-w-[34ch] lg:mx-0" style={{ color: "var(--mk-text-muted)" }}>
                      <strong style={{ color: "var(--mk-text)", fontWeight: 600 }}>{tDemo("title")}</strong> {t("film.tryLine")}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                      <Link href={demoUrl} target="_blank" rel="noopener noreferrer" aria-label={tDemo("addToAppleWallet")}>
                        <Image src="/wallet-buttons/US-UK_Add_to_Apple_Wallet_RGB_101421.svg" alt={tDemo("addToAppleWallet")} width={156} height={48} className="h-11 w-auto" />
                      </Link>
                      <Link href={demoUrl} target="_blank" rel="noopener noreferrer" aria-label={tDemo("addToGoogleWallet")}>
                        <Image src="/wallet-buttons/enGB_add_to_google_wallet_add-wallet-badge.svg" alt={tDemo("addToGoogleWallet")} width={180} height={48} className="h-11 w-auto" />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* The stage: everything hangs off the phone's own position */}
          <motion.div
            style={{ x, perspective: 1400 }}
            className="absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2 lg:top-1/2"
          >
            {/* Chapter 2: the map behind the phone */}
            <motion.div
              aria-hidden="true"
              style={{ opacity: mapOpacity, y: mapY, width: narrow ? phoneW * 1.75 : phoneW * 1.55, rotate: narrow ? 0 : -3, left: narrow ? "50%" : "42%", x: narrow ? "-50%" : 0 }}
              className="pointer-events-none absolute top-1/2 -translate-y-1/2"
            >
              <MapScene walk={walk} pulse={pulse} className="h-auto w-full" style={{ filter: "drop-shadow(0 24px 40px oklch(0 0 0 / 0.14))" }} />
            </motion.div>

            {/* Chapter 3: the crowd behind */}
            {[crowdLeft, crowdRight].map((mv, i) => (
              <motion.div
                key={i}
                aria-hidden="true"
                style={{ opacity: crowdOpacity, x: mv, width: phoneW * 0.84, height: (phoneW * 0.84 - 16) * (844 / 390) * 0.86, border: "6px solid oklch(0.16 0.006 60 / 0.18)" }}
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[40px]"
              />
            ))}

            {/* Chapter 1: the tent on the counter, beside the phone */}
            {tent && (
              <motion.div
                aria-hidden="true"
                style={{ opacity: tentOpacity, x: tentX, right: "calc(100% + 16px)", width: 230, height: 270 }}
                className="pointer-events-none absolute top-[4%] hidden lg:block"
              >
                {tent}
                <p className="mk-caption mt-2 text-center" style={{ color: "var(--mk-text-muted)" }}>{t("film.tentNote")}</p>
              </motion.div>
            )}

            {/* Chapter 1: the envelope, under the tent */}
            <motion.div
              aria-hidden="true"
              style={{ opacity: mailOpacity, x: mailX, right: "calc(100% + 28px)" }}
              className="pointer-events-none absolute top-[48%] hidden w-[200px] rounded-2xl bg-white p-4 lg:block"
            >
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-full" style={{ background: "oklch(0.965 0.003 60)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3 7 9 6 9-6" /></svg>
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold" style={{ color: INK }}>{t("card.business")}</p>
                  <p className="truncate text-[11px]" style={{ color: "oklch(0.5 0.01 40)" }}>{t("film.mailSubject")}</p>
                </div>
              </div>
              <div className="mt-3 rounded-lg px-3 py-2 text-center text-[11px] font-semibold text-white" style={{ background: "#000" }}>
                {t("film.mailButton")}
              </div>
              <p className="mt-2 text-center text-[10px]" style={{ color: "oklch(0.5 0.01 40)" }}>{t("film.alsoGoogle")}</p>
            </motion.div>

            {/* Chapter 3: the dashboard card, beside the phone */}
            <motion.div
              aria-hidden="true"
              style={{ opacity: cardOpacity, x: cardX, right: "calc(100% + 28px)" }}
              className="pointer-events-none absolute top-[44%] hidden w-[200px] rounded-2xl bg-white p-4 lg:block"
            >
              <p className="text-[11px] font-semibold" style={{ color: INK }}>{t("film.sendTitle")}</p>
              <p className="mt-2 rounded-lg px-3 py-2 text-[12px] leading-snug" style={{ background: "oklch(0.965 0.003 60)", color: INK }}>
                {t("film.sendText")}
              </p>
              <div className="mt-2 rounded-full py-1.5 text-center text-[11px] font-semibold" style={{ background: INK, color: "#fff" }}>
                {t("film.sendButton")}
              </div>
            </motion.div>

            {/* The message in flight */}
            <motion.div
              aria-hidden="true"
              style={{ opacity: flyOpacity, x: flyX, y: flyY }}
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 rounded-full px-3 py-1.5 text-[12px] font-medium text-white"
            >
              <span className="block rounded-full px-3 py-1.5" style={{ background: INK }}>{t("film.sendText")}</span>
            </motion.div>

            {/* The phone */}
            <motion.div style={{ rotateY, rotateX, scale, transformStyle: "preserve-3d", willChange: "transform" }}>
              <PhoneFrame width={phoneW} screenBackground="oklch(0.965 0.003 60)">
                {/* Lock screen (intro, chapter 2, chapter 3) */}
                <motion.div style={{ opacity: lockOpacity }} className="absolute inset-0">
                  <LockFace date={t("lockDate")} narrow={narrow} />
                  <motion.div style={{ opacity: nearOpacity, y: nearY, bottom: LOCK_BOTTOM }} className="absolute left-3 right-3">
                    <div>
                      <RealBanner src="/hero/ios-banner.webp" height={193} alt={t("scenes.near.alt")} />
                    </div>
                  </motion.div>
                  <motion.div style={{ opacity: announceOpacity, y: announceY, bottom: LOCK_BOTTOM }} className="absolute left-3 right-3">
                    <div>
                      <RealBanner src="/hero/ios-announce.webp" height={185} alt={t("scenes.announce.alt")} />
                    </div>
                  </motion.div>
                </motion.div>

                {/* Camera (chapter 1a): the counter QR in the viewfinder */}
                <motion.div style={{ opacity: cameraOpacity }} className="absolute inset-0 flex flex-col items-center" >
                  <div className="absolute inset-0" style={{ background: "#0B0A0A" }} />
                  <p className="relative mt-12 text-[13px] font-semibold text-white">{t("film.camera")}</p>
                  <motion.div style={{ scale: scanFrame }} className="relative mt-10 aspect-square w-[64%]">
                    {(["top-0 left-0 border-t-2 border-l-2", "top-0 right-0 border-t-2 border-r-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"] as const).map((pos) => (
                      <span key={pos} className={`absolute size-6 rounded-[3px] ${pos}`} style={{ borderColor: "#fff" }} />
                    ))}
                    <div className="absolute inset-[14%] rounded-md bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr} alt="" className="size-full" />
                    </div>
                  </motion.div>
                  <div className="relative mt-8 rounded-full px-4 py-1.5 text-[12px] font-medium" style={{ background: "oklch(1 0 0 / 0.14)", color: "#fff" }}>
                    {t("film.openLink")}
                  </div>
                </motion.div>

                {/* Wallet (chapter 1b): the pass slides in */}
                <motion.div style={{ opacity: walletOpacity }} className="absolute inset-0" >
                  <div className="absolute inset-0" style={{ background: "oklch(0.965 0.003 60)" }} />
                  <p className="absolute inset-x-0 top-12 text-center text-[13px] font-semibold" style={{ color: INK }}>{t("film.walletTitle")}</p>
                  <motion.div style={{ y: passY }} className="mk-hero-card absolute left-3 right-3" >
                    <div style={{ marginTop: narrow ? 96 : 110 }}>
                      <RealPass alt={t("scenes.passAlt")} />
                    </div>
                  </motion.div>
                </motion.div>

                {/* Wallet (exit): the card filled, the reward ready */}
                <motion.div style={{ opacity: wallet2Opacity }} className="absolute inset-0">
                  <div className="absolute inset-0" style={{ background: "oklch(0.965 0.003 60)" }} />
                  <p className="absolute inset-x-0 top-12 text-center text-[13px] font-semibold" style={{ color: INK }}>{t("film.walletTitle")}</p>
                  <motion.div style={{ y: pass2Y }} className="mk-hero-card absolute left-3 right-3">
                    <div style={{ marginTop: narrow ? 152 : 150 }}>
                      <RealPass alt={t("scenes.passAlt")} />
                    </div>
                  </motion.div>
                  <motion.div style={{ opacity: rewardOpacity, y: rewardY }} className="absolute left-3 right-3 z-10" >
                    <div style={{ marginTop: 44 }}>
                      <RewardBanner title="Loyalshy" body={t("scenes.reward.notification")} />
                    </div>
                  </motion.div>
                </motion.div>
              </PhoneFrame>
            </motion.div>
          </motion.div>
        </div>
      </div>
      {/* "Try it" links land here: the film's last frame, with the wallet buttons */}
      <div id="try-demo" aria-hidden="true" className="absolute bottom-0 h-px w-full" style={{ scrollMarginTop: "100vh" }} />
    </div>
  )
}

/* ─── Reduced motion: the three chapters as frames ─────────────────── */

function Frames({ qr, demoUrl }: { qr: string; demoUrl?: string }) {
  const t = useTranslations("hero")
  const tDemo = useTranslations("tryDemo")
  const w = 230
  void qr
  const frames = [
    {
      key: "ch1",
      screen: (
        <div className="absolute inset-0" style={{ background: "oklch(0.965 0.003 60)" }}>
          <p className="absolute inset-x-0 top-12 text-center text-[13px] font-semibold" style={{ color: INK }}>{t("film.walletTitle")}</p>
          <div className="absolute left-3 right-3" style={{ top: 96 }}>
            <RealPass alt={t("scenes.passAlt")} />
          </div>
        </div>
      ),
    },
    {
      key: "ch2",
      screen: (
        <div className="absolute inset-0">
          <LockFace date={t("lockDate")} narrow />
          <div className="absolute left-3 right-3" style={{ bottom: LOCK_BOTTOM }}>
            <RealBanner src="/hero/ios-banner.webp" height={193} alt={t("scenes.near.alt")} />
          </div>
        </div>
      ),
    },
    {
      key: "ch3",
      screen: (
        <div className="absolute inset-0">
          <LockFace date={t("lockDate")} narrow />
          <div className="absolute left-3 right-3" style={{ bottom: LOCK_BOTTOM }}>
            <RealBanner src="/hero/ios-announce.webp" height={185} alt={t("scenes.announce.alt")} />
          </div>
        </div>
      ),
    },
    {
      key: "ch4",
      screen: (
        <div className="absolute inset-0" style={{ background: "oklch(0.965 0.003 60)" }}>
          <div className="absolute left-3 right-3" style={{ top: 96 }}>
            <RealPass alt={t("scenes.passAlt")} />
          </div>
          <div className="absolute left-3 right-3 z-10" style={{ top: 40 }}>
            <RewardBanner title="Loyalshy" body={t("scenes.reward.notification")} />
          </div>
        </div>
      ),
    },
  ] as const
  return (
    <div className="mk-wrap grid grid-cols-1 gap-12 py-16 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
      {frames.map((f) => (
        <figure key={f.key} className="flex flex-col items-center gap-5 text-center">
          <PhoneFrame width={w}>{f.screen}</PhoneFrame>
          <figcaption>
            <h2 className="mk-title-4" style={{ color: "var(--mk-text)" }}>{t(`film.${f.key}.title`)}</h2>
            <p className="mk-body-sm mt-1 max-w-[32ch]" style={{ color: "var(--mk-text-muted)" }}>{t(`film.${f.key}.caption`)}</p>
          </figcaption>
        </figure>
      ))}
      {demoUrl && (
        <div id="try-demo" className="flex flex-col items-center gap-3 text-center md:col-span-2 lg:col-span-4">
          <p className="mk-body" style={{ color: "var(--mk-text-muted)" }}>
            <strong style={{ color: "var(--mk-text)", fontWeight: 600 }}>{tDemo("title")}</strong> {t("film.tryLine")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href={demoUrl} target="_blank" rel="noopener noreferrer" aria-label={tDemo("addToAppleWallet")}>
              <Image src="/wallet-buttons/US-UK_Add_to_Apple_Wallet_RGB_101421.svg" alt={tDemo("addToAppleWallet")} width={156} height={48} className="h-11 w-auto" />
            </Link>
            <Link href={demoUrl} target="_blank" rel="noopener noreferrer" aria-label={tDemo("addToGoogleWallet")}>
              <Image src="/wallet-buttons/enGB_add_to_google_wallet_add-wallet-badge.svg" alt={tDemo("addToGoogleWallet")} width={180} height={48} className="h-11 w-auto" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export function HeroFilm({ qr, demoUrl, tent }: { qr: string; demoUrl?: string; tent?: ReactNode }) {
  const reduced = useReducedMotion()
  return reduced ? <Frames qr={qr} demoUrl={demoUrl} /> : <Film qr={qr} demoUrl={demoUrl} tent={tent} />
}
