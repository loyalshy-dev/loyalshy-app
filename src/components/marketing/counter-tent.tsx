import { BrandMark } from "@/components/brand-mark"
import { DEMO_PASS_LOGO } from "./demo-pass"
import { demoQrDataUrl } from "./demo-qr"

// The table tent the dashboard prints, as a DOM mock with a real QR.
// Used as the picture for "put the QR out" in How it works.
export async function CounterTent({ business, program, headline, sub, qrAlt }: { business: string; program: string; headline: string; sub: string; qrAlt: string }) {
  const qr = await demoQrDataUrl()
  return (
    <div className="relative flex h-full w-full items-end justify-center pb-10 pt-8" style={{ perspective: 1200 }}>
      <div aria-hidden="true" className="absolute bottom-7 h-5 w-[62%] rounded-[50%]" style={{ background: "radial-gradient(ellipse at center, oklch(0 0 0 / 0.2), transparent 70%)", filter: "blur(4px)" }} />
      <figure
        className="relative flex w-[58%] flex-col items-center rounded-[8px] bg-white px-4 pb-4 pt-5 text-center"
        style={{
          transform: "rotateY(-14deg) rotateX(3deg)",
          transformStyle: "preserve-3d",
          boxShadow: "0 24px 40px -20px oklch(0 0 0 / 0.45), 0 0 0 1px oklch(0 0 0 / 0.05)",
          color: "#1F1410",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={DEMO_PASS_LOGO} alt="" width={32} height={32} className="size-8" />
        <p className="font-display mt-2 text-[15px] font-bold leading-tight">{business}</p>
        <p className="mt-0.5 text-[9px]" style={{ color: "oklch(0.5 0.01 40)" }}>{program}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={qrAlt} width={120} height={120} className="mt-3 w-[72%]" />
        <p className="mt-3 text-[10px] font-semibold leading-snug">{headline}</p>
        <p className="mt-0.5 text-[8px] leading-snug" style={{ color: "oklch(0.5 0.01 40)" }}>{sub}</p>
        <figcaption className="mt-3 flex items-center gap-1 text-[7px]" style={{ color: "oklch(0.6 0.01 40)" }}>
          <span className="inline-flex" style={{ color: "#FF6B47" }}><BrandMark className="h-1" /></span>
          Loyalshy
        </figcaption>
      </figure>
    </div>
  )
}
