"use client"

import { useEffect } from "react"
import Image from "next/image"
import { motion, useAnimate, type MotionValue } from "motion/react"
import { useTranslations } from "next-intl"
import { INK } from "./tokens"

// The screens the hero phone shows, and the real artefacts on them. Each
// screen fills the phone (absolute inset-0) and takes its opacity (and any
// motion) from the film, so the same screens serve the scroll-driven film
// and the reduced-motion frames.

/** The phone screen's ground: iOS's light gray. */
export const SCREEN_BG = "oklch(0.965 0.003 60)"
/** Where a lock-screen notification's bottom edge sits. */
const LOCK_BOTTOM = 92

// Real artefacts from a client's phone, cropped: two Wallet notifications
// (proximity and announcement) and the pass itself. They carry their own
// name and text, so they are not translated.
export function RealBanner({ src, height, alt }: { src: string; height: number; alt: string }) {
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

export const BANNERS = {
  near: { src: "/hero/ios-banner.webp", height: 193 },
  announce: { src: "/hero/ios-announce.webp", height: 185 },
} as const

export function RealPass({ alt }: { alt: string }) {
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

/** A notification's slot on the lock screen, just above the buttons. */
export function LockNotification({ opacity, y, children }: { opacity?: MotionValue<number>; y?: MotionValue<number>; children: React.ReactNode }) {
  return (
    <motion.div style={{ opacity, y, bottom: LOCK_BOTTOM }} className="absolute left-3 right-3">
      {children}
    </motion.div>
  )
}

// The lock screen as iOS lays it out: date and time up top, the flashlight
// and camera buttons in the bottom corners, the home indicator under them.
// Type scales with the phone (`--phone-w`, set by PhoneFrame).
/** The opening loop: a notification drops in from behind the top edge the
 *  way iOS does — a spring that settles with a small bounce, no fade — sits
 *  over the lock screen for three seconds, then is pulled back up quickly,
 *  shrinking a touch and fading only at the very end. Pauses, repeats.
 *  On desktop it rests under the island; on phones it drops below the
 *  clock, where iOS puts it. The rest is read from `--phone-w` when the
 *  loop starts (client only, so the server markup is the same). */
export function OpeningNotification({ children }: { children: React.ReactNode }) {
  const [scope, animate] = useAnimate()
  useEffect(() => {
    let live = true
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
    const restY = () => {
      const el = scope.current as HTMLElement | null
      if (!el || !window.matchMedia("(max-width: 1023px)").matches) return 40
      const pw = parseFloat(getComputedStyle(el).getPropertyValue("--phone-w")) || 230
      // The clock: 0.2·pw of padding, the date line, the 0.22·pw time, a gap.
      return Math.round(pw * 0.42 + 34)
    }
    const run = async () => {
      while (live) {
        await animate(scope.current, { y: restY(), scale: 1, opacity: 1 }, { type: "spring", stiffness: 240, damping: 20, mass: 0.9 })
        if (!live) return
        await sleep(3000)
        if (!live) return
        await animate(scope.current, { y: -80, scale: 0.95, opacity: [1, 1, 0] }, { duration: 0.4, ease: [0.5, 0, 0.9, 0.4] })
        if (!live) return
        await sleep(1800)
      }
    }
    run()
    return () => {
      live = false
    }
  }, [animate, scope])
  return (
    <motion.div ref={scope} initial={{ y: -80, scale: 0.96, opacity: 1 }} style={{ transformOrigin: "50% 0%" }} className="absolute left-3 right-3 top-0 z-20">
      {children}
    </motion.div>
  )
}

export function LockScreen({ opacity, dim, children }: { opacity?: MotionValue<number>; /** 0–1: how much the wallpaper darkens behind a notification. */ dim?: MotionValue<number>; children?: React.ReactNode }) {
  const t = useTranslations("hero")
  const btn = "absolute bottom-[34px] grid size-11 place-items-center rounded-full"
  const btnStyle = { background: "rgba(255,255,255,0.18)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }
  return (
    <motion.div style={{ opacity }} className="absolute inset-0">
      <div className="absolute inset-0" style={{ background: "#14102a" }}>
        <Image src="/hero/wallpaper.webp" alt="" fill sizes="300px" className="object-cover" priority fetchPriority="high" />
        <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.28) 100%)" }} />
        <motion.div aria-hidden="true" className="absolute inset-0" style={{ background: "#000", opacity: dim }} />
        <div className="relative text-center" style={{ paddingTop: "calc(var(--phone-w) * 0.2)", color: "#fff", textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}>
          <p className="text-[13px] font-medium">{t("lockDate")}</p>
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
      {children}
    </motion.div>
  )
}

/** Chapter 1a: the counter QR in the camera's viewfinder. */
export function CameraScreen({ opacity, scanFrame }: { opacity?: MotionValue<number>; scanFrame?: MotionValue<number> }) {
  const t = useTranslations("hero")
  const corners = ["top-0 left-0 border-t-2 border-l-2", "top-0 right-0 border-t-2 border-r-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"] as const
  return (
    <motion.div style={{ opacity }} className="absolute inset-0 flex flex-col items-center">
      <div className="absolute inset-0" style={{ background: "#0B0A0A" }} />
      <p className="relative mt-12 text-[13px] font-semibold text-white">{t("film.camera")}</p>
      <motion.div style={{ scale: scanFrame }} className="relative mt-10 aspect-square w-[64%]">
        {corners.map((pos) => (
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
  )
}

/** Chapter 1b: Wallet, with the pass sliding in from below. */
export function WalletScreen({ opacity, passY, passAlt = "" }: { opacity?: MotionValue<number>; passY?: MotionValue<number>; passAlt?: string }) {
  const t = useTranslations("hero")
  return (
    <motion.div style={{ opacity }} className="absolute inset-0">
      <div className="absolute inset-0" style={{ background: SCREEN_BG }} />
      <p className="absolute inset-x-0 top-12 text-center text-[13px] font-semibold" style={{ color: INK }}>{t("film.walletTitle")}</p>
      <motion.div style={{ y: passY }} className="absolute left-3 right-3">
        <div style={{ marginTop: "calc(var(--phone-w) * 0.38)" }}>
          <RealPass alt={passAlt} />
        </div>
      </motion.div>
    </motion.div>
  )
}

/** The pass's inset inside the screen, as a fraction of the phone's width. */
export const PASS_TOP = 0.38
const PASS_INSET = 12

// Two real passes, as issued: a pizzeria's stamp card and a burger bar's
// coupon (the same renders the pass-type picker uses). They carry their own
// names and text, so they are not translated.
export const REAL_CARDS = {
  stamp: "/pass-types/stamp-2-apple.webp",
  coupon: "/pass-types/coupon-3-apple.webp",
} as const

/** A real pass, full width of its slot; the shadow follows the rounded
 *  corners baked into the image. */
export function RealCard({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={960}
      height={1350}
      className="h-auto w-full"
      style={{ filter: "drop-shadow(0 14px 18px oklch(0 0 0 / 0.22))" }}
      sizes="400px"
    />
  )
}

/** Chapters 6–7: Wallet with a real stamp card that rises in, then turns
 *  over into a real coupon. With `still` (reduced-motion frames) the stamp
 *  card sits at rest and there is no coupon. */
export function PassScreen({
  opacity, passY, stampRotate, stampVis, couponRotate, couponVis, still, stampAlt = "", couponAlt = "",
}: {
  opacity?: MotionValue<number>
  passY?: MotionValue<number>
  stampRotate?: MotionValue<number>
  stampVis?: MotionValue<number>
  couponRotate?: MotionValue<number>
  couponVis?: MotionValue<number>
  still?: boolean
  stampAlt?: string
  couponAlt?: string
}) {
  const t = useTranslations("hero")
  return (
    <motion.div style={{ opacity }} className="absolute inset-0">
      <div className="absolute inset-0" style={{ background: SCREEN_BG }} />
      <p className="absolute inset-x-0 top-12 text-center text-[13px] font-semibold" style={{ color: INK }}>{t("film.walletTitle")}</p>
      <motion.div style={{ y: passY, left: PASS_INSET, right: PASS_INSET, top: `calc(var(--phone-w) * ${PASS_TOP})` }} className="absolute">
        <div className="relative" style={{ perspective: 1200 }}>
          <motion.div style={{ rotateY: stampRotate, opacity: stampVis, transformStyle: "preserve-3d" }}>
            <RealCard src={REAL_CARDS.stamp} alt={stampAlt} />
          </motion.div>
          {!still && (
            <motion.div style={{ rotateY: couponRotate, opacity: couponVis, transformStyle: "preserve-3d" }} className="absolute inset-0">
              <RealCard src={REAL_CARDS.coupon} alt={couponAlt} />
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

/** A frame with the coupon at rest, for reduced motion. */
export function CouponFrame({ alt = "" }: { alt?: string }) {
  const t = useTranslations("hero")
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0" style={{ background: SCREEN_BG }} />
      <p className="absolute inset-x-0 top-12 text-center text-[13px] font-semibold" style={{ color: INK }}>{t("film.walletTitle")}</p>
      <div style={{ left: PASS_INSET, right: PASS_INSET, top: `calc(var(--phone-w) * ${PASS_TOP})` }} className="absolute">
        <RealCard src={REAL_CARDS.coupon} alt={alt} />
      </div>
    </div>
  )
}

/** The exit: the team app, a real screenshot. */
export function AppScreen({ opacity, y, alt = "", sizes = "300px" }: { opacity?: MotionValue<number>; y?: MotionValue<number>; alt?: string; sizes?: string }) {
  return (
    <motion.div style={{ opacity, y }} className="absolute inset-0">
      <Image src="/staff-app/today.webp" alt={alt} width={1170} height={2416} className="absolute inset-0 h-full w-full object-cover object-top" sizes={sizes} />
    </motion.div>
  )
}

/* ─── Links under the captions ────────────────────────────────────── */

/** The Add to Apple / Google Wallet buttons (chapter 1). */
export function WalletButtons({ demoUrl, align }: { demoUrl: string; align: "left" | "center" }) {
  const t = useTranslations("hero")
  const tDemo = useTranslations("tryDemo")
  const j = align === "left" ? "justify-center lg:justify-start" : "justify-center"
  const m = align === "left" ? "mx-auto lg:mx-0" : "mx-auto"
  return (
    <div>
      <p className={`mk-body-sm mk-film-tryline ${m} max-w-[34ch]`} style={{ color: "var(--mk-text-muted)" }}>
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

/** The App Store / Google Play badges (the exit). */
export function StoreBadges({ appStoreUrl, playStoreUrl, align }: { appStoreUrl: string; playStoreUrl: string; align: "left" | "center" }) {
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

/** The team app's icon, above the exit caption. */
export function AppIcon({ className }: { className?: string }) {
  return <Image src="/staff-app/icon.webp" alt="" width={64} height={64} className={className} style={{ boxShadow: "0 8px 24px oklch(0 0 0 / 0.18), 0 0 0 1px oklch(0 0 0 / 0.06)" }} />
}
