import Image from "next/image"
import { BrandMark } from "@/components/brand-mark"

// The example pieces on /promote, drawn in DOM from real parts: the real
// program QR from the hero, the real passes, the brand mark. Café Sol's
// copy comes in as props so each language reads its own. Every piece sits
// on the same Ash frame as the photos.

const QR = "/hero/real-qr.webp"
const ACCENT = "var(--mk-accent)"

/** A size in px or any CSS length (the film passes container units), times a factor. */
type Size = number | string
const mul = (size: Size, f: number): Size => (typeof size === "number" ? size * f : `calc(${size} * ${f})`)

export type MockCopy = {
  business: string
  program: string
  reward: string
  scanLine: string
  reviewLine: string
  askLine: string
  doorLine: string
  storyLine: string
  staffLine: string
  receiptTotal: string
  fold: string
}

function Frame({ children, alt }: { children: React.ReactNode; alt: string }) {
  return (
    <div
      role="img"
      aria-label={alt}
      className="flex w-full items-center justify-center overflow-hidden rounded-2xl px-6 py-10"
      style={{ aspectRatio: "4/3", background: "var(--mk-surface)", border: "1px solid var(--mk-border)" }}
    >
      {children}
    </div>
  )
}

function Qr({ size }: { size: Size }) {
  return <Image src={QR} alt="" width={640} height={640} style={{ width: size, height: size }} sizes={typeof size === "number" ? `${size}px` : "200px"} className="rounded-sm" />
}

const PAPER = { background: "#fff", color: "#1F1410", boxShadow: "0 18px 30px -16px oklch(0 0 0 / 0.35), 0 0 0 1px oklch(0 0 0 / 0.05)" }

/** A6 card standing on the counter (bare; also floats in the hero film). */
export function CardFace({ m, width = 176, reviews = false }: { m: MockCopy; width?: Size; reviews?: boolean }) {
  return (
    <div className="flex flex-col items-center overflow-hidden rounded-[6px] text-center" style={{ ...PAPER, width, aspectRatio: "105/148" }}>
      <div className="h-[5%] w-full" style={{ background: ACCENT }} />
      <div className="flex flex-1 flex-col items-center justify-center gap-[6%] px-[8%] py-[8%]">
        <p className="font-semibold leading-tight" style={{ fontSize: mul(width, 0.075) }}>{m.business}</p>
        <Qr size={mul(width, 0.56)} />
        <p className="leading-snug" style={{ fontSize: mul(width, 0.052), color: "#5a4f4a" }}>{reviews ? m.reviewLine : m.scanLine}</p>
      </div>
      <p className="pb-[5%]" style={{ fontSize: mul(width, 0.04), color: "#9b918c" }}>loyalshy.com</p>
    </div>
  )
}

export function CounterCardPiece({ m, alt }: { m: MockCopy; alt: string }) {
  return (
    <Frame alt={alt}>
      <CardFace m={m} />
    </Frame>
  )
}

export function TentPiece({ m, alt }: { m: MockCopy; alt: string }) {
  return (
    <Frame alt={alt}>
      <div className="flex items-end gap-0" style={{ perspective: 900 }}>
        <div style={{ transform: "rotateY(28deg)", transformOrigin: "right center" }}>
          <CardFace m={m} width={150} />
        </div>
        <div style={{ transform: "rotateY(-28deg)", transformOrigin: "left center" }}>
          <CardFace m={m} width={150} reviews />
        </div>
      </div>
    </Frame>
  )
}

/** The round door sticker (bare; also floats in the hero film). */
export function DoorStickerArt({ m, size = 200 }: { m: MockCopy; size?: Size }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-full text-center text-white" style={{ width: size, height: size, gap: mul(size, 0.06), background: ACCENT, boxShadow: PAPER.boxShadow }}>
      <p className="max-w-[9ch] font-display font-bold leading-tight" style={{ fontSize: mul(size, 0.075) }}>{m.doorLine}</p>
      <div className="rounded-md bg-white" style={{ padding: mul(size, 0.03) }}>
        <Qr size={mul(size, 0.32)} />
      </div>
      <span className="flex text-white/80" style={{ height: mul(size, 0.05) }}>
        <BrandMark className="h-full" />
      </span>
    </div>
  )
}

export function DoorStickerPiece({ m, alt }: { m: MockCopy; alt: string }) {
  return (
    <Frame alt={alt}>
      <DoorStickerArt m={m} />
    </Frame>
  )
}

export function TicketPiece({ m, alt }: { m: MockCopy; alt: string }) {
  const bars = [60, 40, 52, 36]
  return (
    <Frame alt={alt}>
      <div className="w-[170px] px-4 pb-5 pt-4 font-mono text-[9px]" style={{ ...PAPER, borderRadius: 2, clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 6px), 95% 100%, 90% calc(100% - 6px), 85% 100%, 80% calc(100% - 6px), 75% 100%, 70% calc(100% - 6px), 65% 100%, 60% calc(100% - 6px), 55% 100%, 50% calc(100% - 6px), 45% 100%, 40% calc(100% - 6px), 35% 100%, 30% calc(100% - 6px), 25% 100%, 20% calc(100% - 6px), 15% 100%, 10% calc(100% - 6px), 5% 100%, 0 calc(100% - 6px))" }}>
        <p className="text-center font-semibold">{m.business}</p>
        <div className="mt-3 space-y-1.5">
          {bars.map((w, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="h-1.5 rounded-sm" style={{ width: `${w}%`, background: "#e6e1dd" }} />
              <span className="h-1.5 w-5 rounded-sm" style={{ background: "#e6e1dd" }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t border-dashed pt-2 font-semibold" style={{ borderColor: "#d9d3ce" }}>
          <span>{m.receiptTotal}</span>
          <span>7,40 €</span>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-dashed pt-3" style={{ borderColor: "#d9d3ce" }}>
          <Qr size={34} />
          <p className="font-sans text-[9px] font-semibold leading-tight">{m.askLine}</p>
        </div>
      </div>
    </Frame>
  )
}

export function StoryPiece({ m, alt }: { m: MockCopy; alt: string }) {
  return (
    <Frame alt={alt}>
      <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-[18px]" style={{ width: 132, aspectRatio: "9/16", background: "linear-gradient(160deg, oklch(0.25 0.03 38), oklch(0.17 0.02 38))", boxShadow: PAPER.boxShadow }}>
        <div className="w-[70%] rotate-[-6deg]">
          <Image src="/pass-types/stamp-2-apple.webp" alt="" width={960} height={1350} className="h-auto w-full rounded-[5px]" sizes="100px" />
        </div>
        <p className="mt-4 rounded-full bg-white px-2.5 py-1 text-[8px] font-semibold" style={{ color: "#1F1410" }}>{m.storyLine}</p>
        <p className="mt-1.5 text-[7px] text-white/70">loyalshy.com/join/cafe-sol</p>
      </div>
    </Frame>
  )
}

export function StaffPiece({ m, alt }: { m: MockCopy; alt: string }) {
  return (
    <Frame alt={alt}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative max-w-[240px] rounded-2xl px-5 py-4 text-center" style={PAPER}>
          <p className="font-display text-[19px] font-bold leading-tight">“{m.staffLine}”</p>
          <span aria-hidden="true" className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 bg-white" />
        </div>
        <Image src="/staff-app/icon.webp" alt="" width={64} height={64} className="size-10 rounded-[10px]" style={{ boxShadow: "0 6px 16px oklch(0 0 0 / 0.18)" }} />
      </div>
    </Frame>
  )
}

/** The small reviews card (bare; also floats in the hero film). */
export function ReviewsCardArt({ m, width = 220 }: { m: MockCopy; width?: Size }) {
  const u = (px: number) => mul(width, px / 220)
  return (
    <div className="flex items-center rounded-[8px]" style={{ ...PAPER, width, aspectRatio: "148/105", gap: u(16), padding: u(16) }}>
      <div className="flex-1">
        <div className="flex gap-0.5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <svg key={i} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" style={{ width: u(12), height: u(12) }}>
              <path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.7 5.9 21l1.3-6.8-5-4.7 6.8-.8z" />
            </svg>
          ))}
        </div>
        <p className="font-semibold leading-snug" style={{ fontSize: u(11), marginTop: u(8) }}>{m.reviewLine}</p>
        <p style={{ fontSize: u(8), marginTop: u(8), color: "#9b918c" }}>{m.business}</p>
      </div>
      <Qr size={u(64)} />
    </div>
  )
}

export function ReviewsPiece({ m, alt }: { m: MockCopy; alt: string }) {
  return (
    <Frame alt={alt}>
      <ReviewsCardArt m={m} />
    </Frame>
  )
}

export function CouponPiece({ alt }: { alt: string }) {
  return (
    <Frame alt={alt}>
      <div className="w-[170px]">
        <Image src="/pass-types/coupon-3-apple.webp" alt="" width={960} height={1350} className="h-auto w-full" sizes="170px" style={{ filter: "drop-shadow(0 14px 18px oklch(0 0 0 / 0.22))" }} />
      </div>
    </Frame>
  )
}
