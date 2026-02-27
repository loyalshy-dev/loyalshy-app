import { Building2 } from "lucide-react"

const RESTAURANTS = [
  { name: "Trattoria Bella", hue: 265 },
  { name: "Sushi Express", hue: 15 },
  { name: "Cafe Lumiere", hue: 145 },
  { name: "The Ember Grill", hue: 35 },
  { name: "Blue Horizon Bistro", hue: 220 },
  { name: "Fern & Root", hue: 160 },
] as const

export function SocialProof() {
  return (
    <section className="border-b border-border/60 bg-muted/30 py-10 sm:py-12">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <p className="text-center text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground mb-8">
          Trusted by 200+ restaurants worldwide
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
          {RESTAURANTS.map((r) => (
            <div
              key={r.name}
              className="flex items-center gap-2 opacity-50 transition-opacity hover:opacity-80"
            >
              <Building2
                className="size-4 shrink-0"
                strokeWidth={1.5}
                style={{ color: `oklch(0.55 0.12 ${r.hue})` }}
              />
              <span className="text-[13px] font-medium text-foreground whitespace-nowrap">
                {r.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
