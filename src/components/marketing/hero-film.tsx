"use client"

import { useCallback, useRef, useState } from "react"
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react"
import { useTranslations } from "next-intl"
import { CHAPTERS, FILM, PIN_VH, type Chapter } from "./film-timeline"
import { useCaption, useFade, useMove, useVisibility } from "./film-hooks"
import { AppIcon, AppScreen, BANNERS, CameraScreen, CouponFrame, LockNotification, LockScreen, OpeningNotification, PassScreen, RealBanner, SCREEN_BG, StoreBadges, WalletButtons, WalletScreen } from "./film-screens"
import { FilmRail } from "./film-rail"
import { ShareTiles } from "./film-share"
import { MapScene } from "./map-scene"
import { PhoneFrame } from "./phone-frame"
import { INK, SPRING_HEAVY, SPRING_LIGHT } from "./tokens"
import { useMediaQuery } from "./use-media-query"

// The hero film: one phone, seven chapters, scroll as the only clock. The
// phone fills the fold at the open and pulls back as the first scroll
// happens; the camera then pushes in on each chapter's climax (see
// `FILM.phone.zoom`). A rail on the left axis names the chapters and jumps.
//   1. Share the programs — the counter QR in the camera (a hard cut from
//      the lock screen, as iOS does), with email and social-network tiles
//      floating around the phone (`film-share.tsx`).
//   2. In their Wallet — the pass slides in, the Add to Wallet buttons come
//      up under the caption.
//   3. It shows up when they are nearby — lock screen, a customer walks
//      into the geofence on the map and the proximity banner drops in.
//   4. Reach them all with one message — the owner writes the notice in the
//      dashboard, it flies to the phone and lands as a notification, two
//      faint phones behind say it reached everyone.
//   5. The team app — the phone's screen becomes the app, store badges.
//   6. The stamp card, up close — the phone returns to the centre and a
//      real stamp card rises into Wallet.
//   7. The coupon — the card turns over into a real coupon; the film's
//      last frame.
// Every moment is a named window in `film-timeline.ts`; the screens are in
// `film-screens.tsx`. Only transform and opacity animate. Rotation stays
// under 20° so the screen stays legible. Reduced motion gets static frames.
//
// Sizing is CSS: `.mk-film` sets `--pw` (the phone's width) from the
// breakpoint and, on phones, from the viewport height, so the server and the
// first client paint agree and the captions always start under the phone.
// `narrow` (a client-only media query) only drives motion values that are
// invisible at scroll 0, so the hydration swap never shows.

type FilmProps = { demoUrl?: string; appStoreUrl: string; playStoreUrl: string }

/* ─── The pinned film ─────────────────────────────────────────────── */

function Film({ demoUrl, appStoreUrl, playStoreUrl }: FilmProps) {
  const t = useTranslations("hero")
  const narrow = useMediaQuery("(max-width: 1023px)")
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] })

  // The phone as an object. Rotation is skipped on phones (touch GPUs); on
  // desktop the phone slides right of the stage whenever the left is in use.
  const rot = narrow ? 0 : 1
  const { phone } = FILM
  const rotateY = useSpring(useTransform(p, [...phone.rotateY.keys], phone.rotateY.values.map((v) => v * rot)), SPRING_HEAVY)
  const rotateX = useSpring(useTransform(p, [...phone.rotateX.keys], phone.rotateX.values.map((v) => v * rot)), SPRING_HEAVY)
  const zoom = narrow ? phone.zoomNarrow : phone.zoom
  const scale = useSpring(useTransform(p, [...zoom.keys], [...zoom.values]), SPRING_HEAVY)
  // The open grows the phone downward from its top edge (so it meets the
  // hero copy and is cut by the fold); push-ins grow from the centre. The
  // origin flips once the pull-back has settled at 1 — at scale 1 the
  // origin has no effect, so the flip is invisible.
  const transformOrigin = useTransform([p, scale], ([v, sc]: number[]) => (v < 0.2 && sc > 1.001 ? "50% 0%" : "50% 50%"))
  // The open's lift is a CSS length (`--lift`, from the viewport height);
  // the spring only drives how much of it applies, 1 → 0 over the pull-back.
  const liftK = useMove(p, FILM.intro.pullBack, 1, 0, SPRING_HEAVY)
  const exitY = useMove(p, phone.exit, 0, narrow ? 0 : phone.exitLift, SPRING_HEAVY)
  const lift = useTransform([liftK, exitY], ([k, e]: number[]) => `calc(var(--lift, 0px) * ${k.toFixed(4)} + ${e.toFixed(1)}px)`)
  // Background layers drift the other way for depth.
  const parallax = useTransform(p, [0, 1], [phone.parallax, -phone.parallax])
  const xTrack = narrow ? { keys: phone.xNarrow.keys, values: phone.xNarrow.values } : { keys: phone.x.keys, values: phone.x.values(phone.shift, phone.side) }
  const x = useSpring(useTransform(p, [...xTrack.keys], [...xTrack.values]), SPRING_HEAVY)

  // The lock screen under everything; the status bar flips with it.
  const lockOpacity = useSpring(useTransform(p, [...FILM.lock.opacity.keys], [...FILM.lock.opacity.values]), SPRING_LIGHT)
  const onLock = useTransform(p, FILM.lock.isOn)
  const [statusColor, setStatusColor] = useState("#fff")
  useMotionValueEvent(onLock, "change", (v) => setStatusColor(v ? "#fff" : INK))

  // Chapter 1: the camera
  const cameraOpacity = useFade(p, FILM.ch1.camera)
  const scanFrame = useMove(p, FILM.ch1.scanFrame, 1.15, 1, SPRING_HEAVY)
  // Chapter 2: Wallet
  const walletOpacity = useFade(p, FILM.ch2.wallet)
  const passY = useMove(p, FILM.ch2.passRise, 380, 0, SPRING_HEAVY)
  const buttonsOpacity = useFade(p, FILM.ch2.buttons)
  const buttonsY = useMove(p, FILM.ch2.buttonsRise, 12, 0)
  const buttonsVisibility = useVisibility(buttonsOpacity)

  // Chapter 2: the map drifts up slowly and settles late; the customer
  // walks; the pulse fires when they cross the fence; the banner arrives a
  // beat later and overshoots a touch.
  const mapOpacity = useFade(p, FILM.ch3.map)
  const mapY = useMove(p, FILM.ch3.mapRise, 44, 0, { stiffness: 46, damping: 20, mass: 1.3 })
  const walk = useMove(p, FILM.ch3.walk, 0, 1, { stiffness: 60, damping: 22, mass: 1 })
  const pulse = useTransform(p, [...FILM.ch3.pulse], [0, 1])
  const nearY = useMove(p, FILM.ch3.bannerDrop, 34, 0, { stiffness: 150, damping: 15, mass: 0.7 })
  const nearOpacity = useFade(p, FILM.ch3.banner)
  const announceOpacityEarly = useFade(p, FILM.ch4.banner)
  const lockDim = useTransform([nearOpacity, announceOpacityEarly], ([a, b]: number[]) => Math.max(a, b) * 0.22)

  // Chapter 3: the dashboard card slides in from further away, quick and
  // dry; the message flies; the announcement lands with a small bounce; the
  // crowd spreads behind.
  const cardOpacity = useFade(p, FILM.ch4.card)
  const cardX = useMove(p, FILM.ch4.cardSlide, -48, 0, { stiffness: 170, damping: 26, mass: 0.5 })
  const flyX = useMove(p, FILM.ch4.flight, narrow ? 0 : -220, 0)
  const flyY = useMove(p, FILM.ch4.flight, narrow ? 120 : 40, -140)
  const flyOpacity = useFade(p, FILM.ch4.message)
  const announceY = useMove(p, FILM.ch4.bannerDrop, 30, 0, { stiffness: 140, damping: 14, mass: 0.8 })
  const announceOpacity = announceOpacityEarly
  const crowdOpacity = useFade(p, FILM.ch4.crowd)
  const crowdSpread = useMove(p, FILM.ch4.crowdSpread, 0, 1, SPRING_HEAVY)
  const crowdLeft = useTransform(crowdSpread, (v) => -110 * v)
  const crowdRight = useTransform(crowdSpread, (v) => 110 * v)

  // Chapter 4: the team app
  const appOpacity = useFade(p, FILM.ch5.app)
  const appY = useMove(p, FILM.ch5.appRise, 320, 0, SPRING_HEAVY)
  const badgesOpacity = useFade(p, FILM.ch5.badges)
  const badgesY = useMove(p, FILM.ch5.badgesRise, 16, 0)
  const badgesVisibility = useVisibility(badgesOpacity)

  // Chapters 6–7: the real stamp card in Wallet, then turned over into the
  // real coupon.
  const passOpacity = useFade(p, FILM.ch6.wallet)
  const pass2Y = useMove(p, FILM.ch6.passRise, 380, 0, SPRING_HEAVY)
  const stampRotate = useSpring(useTransform(p, [FILM.ch6.flipOut[0], FILM.ch6.flipOut[1]], [0, -90]), SPRING_HEAVY)
  const stampVis = useTransform(p, [FILM.ch6.flipOut[1] - 0.004, FILM.ch6.flipOut[1]], [1, 0])
  const couponRotate = useSpring(useTransform(p, [...FILM.ch7.flipIn], [90, 0]), SPRING_HEAVY)
  const couponVis = useTransform(p, [FILM.ch6.flipOut[1] - 0.004, FILM.ch6.flipOut[1]], [0, 1])

  // Captions
  const captions: Record<Chapter, ReturnType<typeof useCaption>> = {
    ch1: useCaption(p, FILM.ch1.caption, FILM.ch1.captionLag),
    ch2: useCaption(p, FILM.ch2.caption, FILM.ch2.captionLag),
    ch3: useCaption(p, FILM.ch3.caption, FILM.ch3.captionLag),
    ch4: useCaption(p, FILM.ch4.caption, FILM.ch4.captionLag),
    ch5: useCaption(p, FILM.ch5.caption, FILM.ch5.captionLag),
    ch6: useCaption(p, FILM.ch6.caption, FILM.ch6.captionLag),
    ch7: useCaption(p, FILM.ch7.caption, FILM.ch7.captionLag),
  }
  const intro = useFade(p, FILM.intro.fade)
  const introVisibility = useVisibility(intro)
  // The opening loop runs only while the stage is at the open; it remounts
  // (and restarts in step) whenever the visitor scrolls back up.
  const [atOpen, setAtOpen] = useState(true)
  useMotionValueEvent(p, "change", (v) => setAtOpen(v < FILM.intro.fade[3]))

  // The rail jumps to a chapter: progress 0 is the stage's top at the
  // viewport's top, 1 is its bottom at the viewport's bottom.
  const scrollTo = useCallback((progress: number) => {
    const el = ref.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + progress * (el.offsetHeight - window.innerHeight), behavior: "smooth" })
  }, [])

  // Announce which chapter is on for assistive tech.
  const liveRef = useRef<HTMLParagraphElement>(null)
  useMotionValueEvent(p, "change", (v) => {
    const el = liveRef.current
    if (!el) return
    const ch = FILM.chapterAt(v)
    const next = ch ? t(`film.${ch}.title`) : ""
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
          <FilmRail p={p} scrollTo={scrollTo} />
          <motion.p style={{ opacity: intro, visibility: introVisibility }} className="mk-body-sm absolute inset-x-0 bottom-4 z-10 text-center lg:hidden" aria-hidden="true">
            <span style={{ color: "var(--mk-text-muted)" }}>{t("film.scroll")}</span>
          </motion.p>
          {/* Captions: under the phone on phones, on the left axis on desktop */}
          <div className="mk-film-captions">
            {CHAPTERS.map((key) => {
              const c = captions[key]
              // Chapters 6–7 play with the phone at the centre: narrower captions.
              const centred = key === "ch6" || key === "ch7"
              return (
                <motion.div key={key} style={{ visibility: c.visibility }} className="absolute inset-x-0 top-0 text-center lg:text-left">
                  {key === "ch5" && (
                    <motion.div style={{ opacity: c.title.o, y: c.title.y }} className="mb-3 flex justify-center lg:mb-5 lg:justify-start">
                      <AppIcon className="size-12 rounded-[11px] lg:size-16 lg:rounded-[15px]" />
                    </motion.div>
                  )}
                  <motion.h2 style={{ opacity: c.title.o, y: c.title.y }} className={centred ? "font-display mk-display-2 lg:max-w-[10ch]" : "font-display mk-display-2 lg:max-w-[14ch]"}>
                    <span style={{ color: "var(--mk-text)" }}>{t(`film.${key}.title`)}</span>
                  </motion.h2>
                  {key !== "ch3" && (
                    <motion.p style={{ opacity: c.body.o, y: c.body.y }} className={centred ? "mk-lead mx-auto mt-3 max-w-[40ch] lg:mx-0 lg:mt-4 lg:max-w-[26ch]" : "mk-lead mx-auto mt-3 max-w-[40ch] lg:mx-0 lg:mt-4"}>
                      {t(`film.${key}.caption`)}
                    </motion.p>
                  )}
                  {key === "ch2" && demoUrl && (
                    <motion.div style={{ opacity: buttonsOpacity, y: buttonsY, visibility: buttonsVisibility }} className="mt-4 lg:mt-6">
                      <WalletButtons demoUrl={demoUrl} align="left" />
                    </motion.div>
                  )}
                  {key === "ch5" && (
                    <motion.div style={{ opacity: badgesOpacity, y: badgesY, visibility: badgesVisibility }} className="mt-5 lg:mt-7">
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
              style={{ opacity: mapOpacity, y: mapY, rotate: narrow ? 0 : -3, left: narrow ? `calc(50% + ${phone.mapOffsetNarrow}px)` : "50%", x: narrow ? "-50%" : 0 }}
              className="mk-film-map pointer-events-none absolute top-1/2 -translate-y-1/2"
            >
              <motion.div style={{ y: parallax }}>
                <MapScene walk={walk} pulse={pulse} label={t("film.mapLabel")} className="w-full" style={{ boxShadow: "0 30px 60px -20px oklch(0 0 0 / 0.45), 0 0 0 1px oklch(0 0 0 / 0.08)" }} />
              </motion.div>
            </motion.div>

            {/* Chapter 1: how a program is shared, around the phone */}
            <ShareTiles p={p} narrow={narrow} />

            {/* Chapter 3: the crowd behind */}
            {[crowdLeft, crowdRight].map((mv, i) => (
              <motion.div
                key={i}
                style={{ opacity: crowdOpacity, x: mv, y: parallax, border: "6px solid oklch(0.16 0.006 60 / 0.18)" }}
                className="mk-film-crowd pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[40px]"
              />
            ))}

            {/* Chapter 3: the dashboard card, beside the phone */}
            <motion.div
              style={{ opacity: cardOpacity, x: cardX, right: "calc(100% + 28px)" }}
              className="pointer-events-none absolute top-[44%] hidden w-[200px] rounded-2xl bg-white p-4 lg:block"
            >
              <p className="text-[11px] font-semibold" style={{ color: INK }}>{t("film.sendTitle")}</p>
              <p className="mt-2 rounded-lg px-3 py-2 text-[12px] leading-snug" style={{ background: SCREEN_BG, color: INK }}>
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
            <motion.div style={{ rotateY, rotateX, scale, y: lift, transformOrigin, transformStyle: "preserve-3d", willChange: "transform" }}>
              <PhoneFrame width="var(--pw)" screenBackground={SCREEN_BG} statusColor={statusColor}>
                <LockScreen opacity={lockOpacity} dim={lockDim}>
                  {/* The open: a proximity notification drops in from under the
                      island over the lock screen, stays three seconds and
                      leaves, on a loop */}
                  {atOpen && (
                    <OpeningNotification>
                      <RealBanner {...BANNERS.near} alt="" />
                    </OpeningNotification>
                  )}
                  <LockNotification opacity={nearOpacity} y={nearY}>
                    <RealBanner {...BANNERS.near} alt="" />
                  </LockNotification>
                  <LockNotification opacity={announceOpacity} y={announceY}>
                    <RealBanner {...BANNERS.announce} alt="" />
                  </LockNotification>
                </LockScreen>
                <CameraScreen opacity={cameraOpacity} scanFrame={scanFrame} />
                <WalletScreen opacity={walletOpacity} passY={passY} />
                <AppScreen opacity={appOpacity} y={appY} />
                <PassScreen opacity={passOpacity} passY={pass2Y} stampRotate={stampRotate} stampVis={stampVis} couponRotate={couponRotate} couponVis={couponVis} />
              </PhoneFrame>
            </motion.div>
          </motion.div>
        </div>
      </div>
      {/* "Try it" links land on chapter 1, with the pass in Wallet and the buttons up;
          "Cards" links land on chapter 5, and that anchor spans the card chapters
          so the nav marks it while they play. */}
      <div id="try-demo" aria-hidden="true" className="absolute h-px w-full" style={{ top: `${(PIN_VH - 100) * FILM.tryDemoAt}vh` }} />
      <div id="cards" aria-hidden="true" className="pointer-events-none absolute w-full" style={{ top: `${(PIN_VH - 100) * FILM.cardsAt}vh`, height: `${(PIN_VH - 100) * (1 - FILM.cardsAt) + 100}vh` }} />
    </div>
  )
}

/* ─── Reduced motion: the chapters as frames ───────────────────────── */

function Frames({ demoUrl, appStoreUrl, playStoreUrl }: FilmProps) {
  const t = useTranslations("hero")
  const w = 230
  const frames: Array<{ key: Chapter; dark: boolean; screen: React.ReactNode }> = [
    { key: "ch1", dark: true, screen: <CameraScreen /> },
    { key: "ch2", dark: false, screen: <WalletScreen passAlt={t("scenes.passAlt")} /> },
    {
      key: "ch3",
      dark: true,
      screen: (
        <LockScreen>
          <LockNotification>
            <RealBanner {...BANNERS.near} alt={t("scenes.near.alt")} />
          </LockNotification>
        </LockScreen>
      ),
    },
    {
      key: "ch4",
      dark: true,
      screen: (
        <LockScreen>
          <LockNotification>
            <RealBanner {...BANNERS.announce} alt={t("scenes.announce.alt")} />
          </LockNotification>
        </LockScreen>
      ),
    },
    { key: "ch5", dark: false, screen: <AppScreen alt={t("film.appAlt")} sizes="230px" /> },
    { key: "ch6", dark: false, screen: <PassScreen still stampAlt={t("film.stampAlt")} /> },
    { key: "ch7", dark: false, screen: <CouponFrame alt={t("film.couponAlt")} /> },
  ]
  return (
    <div className="mk-wrap grid grid-cols-1 gap-12 py-16 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
      {frames.map((f) => (
        <figure key={f.key} className="flex flex-col items-center gap-5 text-center">
          <PhoneFrame width={w} screenBackground={SCREEN_BG} statusColor={f.dark ? "#fff" : INK}>{f.screen}</PhoneFrame>
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
        <AppIcon className="size-16 rounded-[15px]" />
        <StoreBadges appStoreUrl={appStoreUrl} playStoreUrl={playStoreUrl} align="center" />
      </div>
    </div>
  )
}

export function HeroFilm(props: FilmProps) {
  const reduced = useReducedMotion()
  return reduced ? <Frames {...props} /> : <Film {...props} />
}
