"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react"
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
//
// Sizing is CSS: `.mk-film` sets `--pw` (the phone's width) from the
// breakpoint and, on phones, from the viewport height, so the server and the
// first client paint agree and the captions always start under the phone.
// `narrow` (a client-only media query) only drives motion values that are
// invisible at scroll 0, so the hydration swap never shows.

const INK = "#1F1410"
// Two weights: the phone, the map and the pass are heavy and settle slowly;
// text, banners and side cards are light and answer quickly. Opacities go
// through a spring too, so a wheel notch never completes a fade in one frame.
const HEAVY = { stiffness: 70, damping: 22, mass: 1 }
const LIGHT = { stiffness: 110, damping: 24, mass: 0.6 }
// How long the stage stays pinned, in viewport heights. The story plays over
// (PIN_VH − 100)vh of scroll, so 880 gives ~7.8 screens. Each notification
// holds for ~10% of the film (about a screen of scroll) once it has landed. Raise it to slow the film down, lower to speed up.
const PIN_VH = 880

// Anything that fades out must also leave the accessibility tree and the tab
// order: opacity alone keeps invisible links focusable and invisible text
// readable. `visibility` follows the opacity.
function useVisibility(...opacities: MotionValue<number>[]) {
  return useTransform(opacities, (values: number[]) => (values.some((v) => v > 0.02) ? "visible" : "hidden"))
}

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

type FilmProps = { demoUrl?: string; appStoreUrl: string; playStoreUrl: string }

// The wallet buttons (chapter 1) and the store badges (the exit), shared by
// the film and the reduced-motion frames.
function WalletButtons({ demoUrl, align }: { demoUrl: string; align: "left" | "center" }) {
  const t = useTranslations("hero")
  const tDemo = useTranslations("tryDemo")
  const j = align === "left" ? "justify-center lg:justify-start" : "justify-center"
  const m = align === "left" ? "mx-auto lg:mx-0" : "mx-auto"
  return (
    <div>
      <p className={`mk-body-sm ${m} max-w-[34ch]`} style={{ color: "var(--mk-text-muted)" }}>
        <strong style={{ color: "var(--mk-text)", fontWeight: 600 }}>{tDemo("title")}</strong> {t("film.tryLine")}
      </p>
      <div className={`mt-3 flex flex-wrap items-center gap-3 ${j}`}>
        <a href={demoUrl} target="_blank" rel="noopener noreferrer" aria-label={tDemo("addToAppleWallet")}>
          <Image src="/wallet-buttons/US-UK_Add_to_Apple_Wallet_RGB_101421.svg" alt="" width={156} height={48} className="h-11 w-auto" />
        </a>
        <a href={demoUrl} target="_blank" rel="noopener noreferrer" aria-label={tDemo("addToGoogleWallet")}>
          <Image src="/wallet-buttons/enGB_add_to_google_wallet_add-wallet-badge.svg" alt="" width={180} height={48} className="h-11 w-auto" />
        </a>
      </div>
    </div>
  )
}

function StoreBadges({ appStoreUrl, playStoreUrl, align }: { appStoreUrl: string; playStoreUrl: string; align: "left" | "center" }) {
  const t = useTranslations("hero")
  const j = align === "left" ? "justify-center lg:justify-start" : "justify-center"
  const badges = [
    { url: appStoreUrl, src: "/staff-app/Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg", label: t("film.appStore"), w: 156 },
    { url: playStoreUrl, src: "/staff-app/GetItOnGooglePlay_Badge_Web_color_English.svg", label: t("film.playStore"), w: 180 },
  ]
  return (
    <div className={`flex flex-wrap items-center gap-3 ${j}`}>
      {badges.map((b) => (
        <a key={b.src} href={b.url} target="_blank" rel="noopener noreferrer" aria-label={b.label}>
          <Image src={b.src} alt="" width={b.w} height={48} className="h-11 w-auto" />
        </a>
      ))}
    </div>
  )
}

// The lock screen as iOS lays it out: date and time up top, the flashlight
// and camera buttons in the bottom corners, the home indicator under them.
// Notifications land just above the buttons. Type scales with the phone.
const LOCK_BOTTOM = 92 // where a notification's bottom edge sits

function LockFace({ date }: { date: string }) {
  const btn = "absolute bottom-[34px] grid size-11 place-items-center rounded-full"
  const btnStyle = { background: "rgba(255,255,255,0.18)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }
  return (
    <div className="absolute inset-0" style={{ background: "#14102a" }}>
      <Image src="/hero/wallpaper.webp" alt="" fill sizes="300px" className="object-cover" priority />
      <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.28) 100%)" }} />
      <div className="relative text-center" style={{ paddingTop: "calc(var(--phone-w) * 0.2)", color: "#fff", textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}>
        <p className="text-[13px] font-medium">{date}</p>
        <p className="font-display font-bold leading-none tracking-tight" style={{ fontSize: "calc(var(--phone-w) * 0.22)" }}>9:41</p>
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
      <div aria-hidden="true" className="absolute bottom-2 left-1/2 h-[5px] w-[34%] -translate-x-1/2 rounded-full" style={{ background: "#fff", opacity: 0.9 }} />
    </div>
  )
}

const CHAPTERS = ["ch1", "ch2", "ch3", "ch4"] as const

/* ─── The pinned film ─────────────────────────────────────────────── */

function Film({ demoUrl, appStoreUrl, playStoreUrl }: FilmProps) {
  const t = useTranslations("hero")
  const narrow = useMediaQuery("(max-width: 1023px)")
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] })

  // A fade that a scroll notch can't finish in one frame.
  const useFade = (keys: number[], values: number[]) => useSpring(useTransform(p, keys, values), LIGHT)

  // The phone as an object. Rotation is skipped on phones (touch GPUs).
  const rot = narrow ? 0 : 1
  const rotateY = useSpring(useTransform(p, [0, 0.08, 0.24, 0.38, 0.46, 0.7, 0.76, 0.96, 1], [0, -18 * rot, 0, 0, 12 * rot, 12 * rot, 0, 0, 0]), HEAVY)
  const rotateX = useSpring(useTransform(p, [0, 0.24, 0.46, 0.76, 0.96], [0, 4 * rot, -3 * rot, 0, 0]), HEAVY)
  const scale = useSpring(useTransform(p, [0, 0.08, 0.24, 0.38, 0.46, 0.7, 0.76, 0.94, 1], [1, 1, 1.1, 1.1, 1.04, 1.04, 0.92, 0.92, 0.98]), HEAVY)
  // On desktop the phone opens centered on the stage and slides over to the
  // right as the first caption arrives, then drifts a little further whenever
  // a card sits beside it.
  const shift = narrow ? 0 : 240
  const side = narrow ? 0 : 56
  const x = useSpring(useTransform(p, [0, 0.1, 0.26, 0.38, 0.46, 0.7, 0.76, 0.94, 0.99], narrow ? [0, 0, 0, 0, 0, 0, 0, 0, 0] : [0, shift, shift + side, shift + side, shift - 30, shift - 30, shift + side, shift + side, shift]), HEAVY)

  // Screen layers
  const lockOpacity = useFade([0, 0.06, 0.12, 0.34, 0.38, 0.94, 0.96], [1, 1, 0, 0, 1, 1, 0])
  const onLock = useTransform(p, (v) => v < 0.09 || (v > 0.36 && v < 0.95))
  const [statusColor, setStatusColor] = useState("#fff")
  useMotionValueEvent(onLock, "change", (v) => setStatusColor(v ? "#fff" : INK))
  const cameraOpacity = useFade([0.06, 0.12, 0.2, 0.26], [0, 1, 1, 0])
  const scanFrame = useSpring(useTransform(p, [0.1, 0.2], [1.15, 1]), HEAVY)
  const walletOpacity = useFade([0.2, 0.26, 0.33, 0.38], [0, 1, 1, 0])
  const passY = useSpring(useTransform(p, [0.22, 0.34], [380, 0]), HEAVY)

  // Chapter 1: the wallet buttons under the caption once the pass is in.
  const walletBtnOpacity = useFade([0.26, 0.31, 0.33, 0.38], [0, 1, 1, 0])
  const walletBtnY = useSpring(useTransform(p, [0.26, 0.32], [12, 0]), LIGHT)
  const walletBtnVisibility = useVisibility(walletBtnOpacity)

  // Chapter 2: the map behind the phone, the customer walking into the
  // fence, the pulse when they cross it, then the banner
  const mapOpacity = useFade([0.42, 0.5, 0.66, 0.7], [0, 1, 1, 0])
  // the map drifts up slowly and settles late
  const mapY = useSpring(useTransform(p, [0.42, 0.54], [44, 0]), { stiffness: 46, damping: 20, mass: 1.3 })
  const walk = useSpring(useTransform(p, [0.44, 0.54], [0, 1]), { stiffness: 60, damping: 22, mass: 1 })
  const pulse = useTransform(p, [0.53, 0.6], [0, 1])
  // the proximity banner arrives a beat after the pulse and overshoots a touch
  const nearY = useSpring(useTransform(p, [0.55, 0.6], [34, 0]), { stiffness: 150, damping: 15, mass: 0.7 })
  const nearOpacity = useFade([0.55, 0.59, 0.66, 0.7], [0, 1, 1, 0])

  // Chapter 3: the dashboard card, the message in flight, the banner, the crowd
  const cardOpacity = useFade([0.74, 0.79, 0.92, 0.95], [0, 1, 1, 0])
  // the dashboard card slides in from further away, quick and dry
  const cardX = useSpring(useTransform(p, [0.74, 0.78], [-48, 0]), { stiffness: 170, damping: 26, mass: 0.5 })
  const flyX = useSpring(useTransform(p, [0.78, 0.82], [narrow ? 0 : -220, 0]), LIGHT)
  const flyY = useSpring(useTransform(p, [0.78, 0.82], [narrow ? 120 : 40, -140]), LIGHT)
  const flyOpacity = useFade([0.775, 0.79, 0.81, 0.825], [0, 1, 1, 0])
  // the announcement lands with a small bounce
  const announceY = useSpring(useTransform(p, [0.82, 0.86], [30, 0]), { stiffness: 140, damping: 14, mass: 0.8 })
  const announceOpacity = useFade([0.82, 0.85, 0.92, 0.95], [0, 1, 1, 0])
  const crowdOpacity = useFade([0.83, 0.87, 0.92, 0.95], [0, 1, 1, 0])
  const crowdSpread = useSpring(useTransform(p, [0.83, 0.88], [0, 1]), HEAVY)
  const crowdLeft = useTransform(crowdSpread, (v) => -110 * v)
  const crowdRight = useTransform(crowdSpread, (v) => 110 * v)

  // The exit: the pass returns with four stamps, the fifth lands, the reward
  // banner drops in, and the phone is back at the centre when the stage lets go.
  const wallet2Opacity = useFade([0.955, 0.97], [0, 1])
  const pass2Y = useSpring(useTransform(p, [0.955, 0.975], [320, 0]), HEAVY)
  const tryOpacity = useFade([0.97, 0.99], [0, 1])
  const tryY = useSpring(useTransform(p, [0.97, 0.99], [16, 0]), LIGHT)
  const tryVisibility = useVisibility(tryOpacity)

  // Captions: each one rises in, holds, and rises out; the paragraph
  // follows the title by a beat. The whole caption leaves the tab order and
  // the accessibility tree while it is invisible.
  const useCaption = (a: number, b: number, c: number, d: number, lag: number) => {
    const t = { o: useSpring(useTransform(p, [a, b, c, d], [0, 1, 1, 0]), LIGHT), y: useSpring(useTransform(p, [a, b, c, d], [28, 0, 0, -22]), LIGHT) }
    const q = { o: useSpring(useTransform(p, [a + lag, b + lag, c, d], [0, 1, 1, 0]), LIGHT), y: useSpring(useTransform(p, [a + lag, b + lag, c, d], [28, 0, 0, -22]), LIGHT) }
    return { t, p: q, visibility: useVisibility(t.o, q.o) }
  }
  const c1 = useCaption(0.07, 0.14, 0.31, 0.37, 0.02)
  const c2 = useCaption(0.43, 0.5, 0.66, 0.71, 0.035)
  const c3 = useCaption(0.75, 0.81, 0.92, 0.96, 0.02)
  const c4 = useCaption(0.955, 0.98, 1.5, 1.6, 0.01)
  const captions = { ch1: c1, ch2: c2, ch3: c3, ch4: c4 }
  const intro = useFade([0, 0.07], [1, 0])
  const introVisibility = useVisibility(intro)

  // Announce which chapter is on for assistive tech.
  const liveRef = useRef<HTMLParagraphElement>(null)
  useMotionValueEvent(p, "change", (v) => {
    const el = liveRef.current
    if (!el) return
    const next = v < 0.08 ? "" : v < 0.4 ? t("film.ch1.title") : v < 0.73 ? t("film.ch2.title") : v < 0.96 ? t("film.ch3.title") : t("film.ch4.title")
    if (el.textContent !== next) el.textContent = next
  })

  return (
    <div ref={ref} className="relative" style={{ height: `${PIN_VH}vh` }}>
      <div className="mk-film sticky overflow-hidden" style={{ top: "var(--mk-bar-h, 48px)", height: "calc(100svh - var(--mk-bar-h, 48px))" }}>
        {/* The whole story in one place for assistive tech; the visible
            captions below come and go with the scroll. */}
        <ol className="sr-only">
          {CHAPTERS.map((key) => (
            <li key={key}>
              <strong>{t(`film.${key}.title`)}</strong> {t(`film.${key}.caption`)}
            </li>
          ))}
        </ol>
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <div className="mk-wrap relative h-full">
          {/* Captions: under the phone on phones, on the left axis on desktop */}
          <div className="mk-film-captions">
            <motion.p style={{ opacity: intro, visibility: introVisibility }} className="mk-lead absolute inset-x-0 top-0 text-center lg:hidden">
              {t("film.scroll")}
            </motion.p>
            {CHAPTERS.map((key) => {
              const c = captions[key]
              return (
                <motion.div key={key} style={{ visibility: c.visibility }} className="absolute inset-x-0 top-0 text-center lg:text-left">
                  {key === "ch4" && (
                    <motion.div style={{ opacity: c.t.o, y: c.t.y }} className="mb-3 flex justify-center lg:mb-5 lg:justify-start">
                      <Image src="/staff-app/icon.webp" alt="" width={64} height={64} className="size-12 rounded-[11px] lg:size-16 lg:rounded-[15px]" style={{ boxShadow: "0 8px 24px oklch(0 0 0 / 0.18), 0 0 0 1px oklch(0 0 0 / 0.06)" }} />
                    </motion.div>
                  )}
                  <motion.h2 style={{ opacity: c.t.o, y: c.t.y }} className="font-display mk-display-2 lg:max-w-[14ch]">
                    <span style={{ color: "var(--mk-text)" }}>{t(`film.${key}.title`)}</span>
                  </motion.h2>
                  {key !== "ch2" && (
                    <motion.p style={{ opacity: c.p.o, y: c.p.y }} className="mk-lead mx-auto mt-3 max-w-[40ch] lg:mx-0 lg:mt-4">
                      {t(`film.${key}.caption`)}
                    </motion.p>
                  )}
                  {key === "ch1" && demoUrl && (
                    <motion.div style={{ opacity: walletBtnOpacity, y: walletBtnY, visibility: walletBtnVisibility }} className="mt-4 lg:mt-6">
                      <WalletButtons demoUrl={demoUrl} align="left" />
                    </motion.div>
                  )}
                  {key === "ch4" && (
                    <motion.div style={{ opacity: tryOpacity, y: tryY, visibility: tryVisibility }} className="mt-5 lg:mt-7">
                      <StoreBadges appStoreUrl={appStoreUrl} playStoreUrl={playStoreUrl} align="left" />
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* The stage: everything hangs off the phone's own position. It is
              pure picture — the words live in the captions and the list above. */}
          <motion.div
            aria-hidden="true"
            style={{ x, perspective: 1400 }}
            className="absolute left-1/2 top-3 -translate-x-1/2 lg:top-1/2 lg:-translate-y-1/2"
          >
            {/* Chapter 2: the map behind the phone */}
            <motion.div
              style={{ opacity: mapOpacity, y: mapY, rotate: narrow ? 0 : -3, left: narrow ? "50%" : "42%", x: narrow ? "-50%" : 0 }}
              className="mk-film-map pointer-events-none absolute top-1/2 -translate-y-1/2"
            >
              <MapScene walk={walk} pulse={pulse} className="h-auto w-full" style={{ filter: "drop-shadow(0 24px 40px oklch(0 0 0 / 0.14))" }} />
            </motion.div>

            {/* Chapter 3: the crowd behind */}
            {[crowdLeft, crowdRight].map((mv, i) => (
              <motion.div
                key={i}
                style={{ opacity: crowdOpacity, x: mv, border: "6px solid oklch(0.16 0.006 60 / 0.18)" }}
                className="mk-film-crowd pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[40px]"
              />
            ))}

            {/* Chapter 3: the dashboard card, beside the phone */}
            <motion.div
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
              style={{ opacity: flyOpacity, x: flyX, y: flyY }}
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 rounded-full px-3 py-1.5 text-[12px] font-medium text-white"
            >
              <span className="block rounded-full px-3 py-1.5" style={{ background: INK }}>{t("film.sendText")}</span>
            </motion.div>

            {/* The phone */}
            <motion.div style={{ rotateY, rotateX, scale, transformStyle: "preserve-3d", willChange: "transform" }}>
              <PhoneFrame width="var(--pw)" screenBackground="oklch(0.965 0.003 60)" statusColor={statusColor}>
                {/* Lock screen (intro, chapter 2, chapter 3) */}
                <motion.div style={{ opacity: lockOpacity }} className="absolute inset-0">
                  <LockFace date={t("lockDate")} />
                  <motion.div style={{ opacity: nearOpacity, y: nearY, bottom: LOCK_BOTTOM }} className="absolute left-3 right-3">
                    <RealBanner src="/hero/ios-banner.webp" height={193} alt="" />
                  </motion.div>
                  <motion.div style={{ opacity: announceOpacity, y: announceY, bottom: LOCK_BOTTOM }} className="absolute left-3 right-3">
                    <RealBanner src="/hero/ios-announce.webp" height={185} alt="" />
                  </motion.div>
                </motion.div>

                {/* Camera (chapter 1a): the counter QR in the viewfinder */}
                <motion.div style={{ opacity: cameraOpacity }} className="absolute inset-0 flex flex-col items-center">
                  <div className="absolute inset-0" style={{ background: "#0B0A0A" }} />
                  <p className="relative mt-12 text-[13px] font-semibold text-white">{t("film.camera")}</p>
                  <motion.div style={{ scale: scanFrame }} className="relative mt-10 aspect-square w-[64%]">
                    {(["top-0 left-0 border-t-2 border-l-2", "top-0 right-0 border-t-2 border-r-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"] as const).map((pos) => (
                      <span key={pos} className={`absolute size-6 rounded-[3px] ${pos}`} style={{ borderColor: "#fff" }} />
                    ))}
                    <div className="absolute inset-[14%] rounded-md bg-white p-2">
                      <Image src="/hero/real-qr.webp" alt="" width={640} height={640} className="size-full" sizes="160px" />
                    </div>
                  </motion.div>
                  <div className="relative mt-8 rounded-full px-4 py-1.5 text-[12px] font-medium" style={{ background: "oklch(1 0 0 / 0.14)", color: "#fff" }}>
                    {t("film.openLink")}
                  </div>
                </motion.div>

                {/* Wallet (chapter 1b): the pass slides in */}
                <motion.div style={{ opacity: walletOpacity }} className="absolute inset-0">
                  <div className="absolute inset-0" style={{ background: "oklch(0.965 0.003 60)" }} />
                  <p className="absolute inset-x-0 top-12 text-center text-[13px] font-semibold" style={{ color: INK }}>{t("film.walletTitle")}</p>
                  <motion.div style={{ y: passY }} className="absolute left-3 right-3">
                    <div style={{ marginTop: "calc(var(--phone-w) * 0.38)" }}>
                      <RealPass alt="" />
                    </div>
                  </motion.div>
                </motion.div>

                {/* The exit: the team app, everything managed from the phone */}
                <motion.div style={{ opacity: wallet2Opacity, y: pass2Y }} className="absolute inset-0">
                  <Image src="/staff-app/today.webp" alt="" width={1170} height={2416} className="absolute inset-0 h-full w-full object-cover object-top" sizes="300px" />
                </motion.div>
              </PhoneFrame>
            </motion.div>
          </motion.div>
        </div>
      </div>
      {/* "Try it" links land on chapter 1, with the pass in Wallet and the buttons up */}
      <div id="try-demo" aria-hidden="true" className="absolute h-px w-full" style={{ top: `${(PIN_VH - 100) * 0.3}vh` }} />
    </div>
  )
}

/* ─── Reduced motion: the three chapters as frames ─────────────────── */

function Frames({ demoUrl, appStoreUrl, playStoreUrl }: FilmProps) {
  const t = useTranslations("hero")
  const w = 230
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
          <LockFace date={t("lockDate")} />
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
          <LockFace date={t("lockDate")} />
          <div className="absolute left-3 right-3" style={{ bottom: LOCK_BOTTOM }}>
            <RealBanner src="/hero/ios-announce.webp" height={185} alt={t("scenes.announce.alt")} />
          </div>
        </div>
      ),
    },
    {
      key: "ch4",
      screen: (
        <Image src="/staff-app/today.webp" alt={t("film.appAlt")} width={1170} height={2416} className="absolute inset-0 h-full w-full object-cover object-top" sizes="230px" />
      ),
    },
  ] as const
  return (
    <div className="mk-wrap grid grid-cols-1 gap-12 py-16 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
      {frames.map((f) => (
        <figure key={f.key} className="flex flex-col items-center gap-5 text-center">
          <PhoneFrame width={w} statusColor={f.key === "ch2" || f.key === "ch3" ? "#fff" : INK}>{f.screen}</PhoneFrame>
          <figcaption>
            <h2 className="mk-title-4" style={{ color: "var(--mk-text)" }}>{t(`film.${f.key}.title`)}</h2>
            <p className="mk-body-sm mt-1 max-w-[32ch]" style={{ color: "var(--mk-text-muted)" }}>{t(`film.${f.key}.caption`)}</p>
          </figcaption>
        </figure>
      ))}
      {demoUrl && (
        <div id="try-demo" className="flex flex-col items-center text-center md:col-span-2 lg:col-span-4">
          <WalletButtons demoUrl={demoUrl} align="center" />
        </div>
      )}
      <div className="flex flex-col items-center gap-4 text-center md:col-span-2 lg:col-span-4">
        <Image src="/staff-app/icon.webp" alt="" width={64} height={64} className="size-16 rounded-[15px]" />
        <StoreBadges appStoreUrl={appStoreUrl} playStoreUrl={playStoreUrl} align="center" />
      </div>
    </div>
  )
}

export function HeroFilm(props: FilmProps) {
  const reduced = useReducedMotion()
  return reduced ? <Frames {...props} /> : <Film {...props} />
}
