/**
 * Testimonials — Marketing section component
 *
 * Usage:
 *   import { Testimonials } from "@/components/marketing/testimonials"
 *   <Testimonials />
 *
 * Server Component — no client-side interactivity required.
 * Avatar colors are deterministically derived from the testimonial name
 * using the same palette convention as the dashboard's top-customers component.
 */

// ─── Avatar Color Palette ──────────────────────────────────
// OKLCH-derived palette — matches globals.css chart tokens
const AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: "bg-chart-1/15", text: "text-chart-1" },
  { bg: "bg-chart-2/15", text: "text-chart-2" },
  { bg: "bg-chart-3/15", text: "text-chart-3" },
  { bg: "bg-chart-4/15", text: "text-chart-4" },
  { bg: "bg-chart-5/15", text: "text-chart-5" },
  { bg: "bg-brand/15",   text: "text-brand"   },
]

function getAvatarColor(name: string): { bg: string; text: string } {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// ─── Testimonial Data ──────────────────────────────────────

const testimonials = [
  {
    name: "Maria Santos",
    role: "Owner, Trattoria Bella",
    stat: "3x",
    statLabel: "more repeat visits",
    quote:
      "We replaced our old paper punch cards and saw 3x more repeat visits in the first month. The wallet passes are beautiful and customers actually keep them.",
  },
  {
    name: "James Chen",
    role: "Manager, Sushi Express",
    stat: "5 min",
    statLabel: "setup time",
    quote:
      "Setup took literally 5 minutes. Our staff loves how easy it is to register visits, and customers love the digital cards. No more lost punch cards.",
  },
  {
    name: "Sophie Dubois",
    role: "Owner, Cafe Lumiere",
    stat: "40%",
    statLabel: "revenue increase",
    quote:
      "The analytics alone are worth it. I finally know which customers are my regulars and can reward them properly. Revenue from repeat customers is up 40%.",
  },
  {
    name: "Luca Moretti",
    role: "Owner, Pizzeria Napoli",
    stat: "850+",
    statLabel: "loyalty members",
    quote:
      "We went from zero to 850 loyalty members in three months. The QR code at the counter does all the work — customers sign up themselves.",
  },
  {
    name: "Aisha Patel",
    role: "Manager, Spice Garden",
    stat: "92%",
    statLabel: "redemption rate",
    quote:
      "Our redemption rate went from 15% with paper cards to 92% with Fidelio. Digital passes actually get used because they're always in the customer's phone.",
  },
  {
    name: "Thomas Bergström",
    role: "Owner, Nordic Kitchen",
    stat: "2 hrs",
    statLabel: "saved per week",
    quote:
      "We used to spend hours managing punch cards and tracking rewards manually. Fidelio automated everything. My staff can focus on what matters — great food.",
  },
] as const

// ─── Quote Icon ────────────────────────────────────────────

function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="16"
      viewBox="0 0 20 16"
      fill="currentColor"
      className={className}
    >
      <path d="M0 16V9.5C0 5.9 2.3 2.9 6.9 0l1.4 1.8C5.8 3.3 4.4 5.2 4 8h3.5V16H0zm10 0V9.5C10 5.9 12.3 2.9 16.9 0l1.4 1.8C15.8 3.3 14.4 5.2 14 8h3.5V16H10z" />
    </svg>
  )
}

// ─── Testimonial Card ──────────────────────────────────────

type TestimonialCardProps = {
  name: string
  role: string
  quote: string
  stat: string
  statLabel: string
}

function TestimonialCard({ name, role, quote, stat, statLabel }: TestimonialCardProps) {
  const color = getAvatarColor(name)
  const initials = getInitials(name)

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
      {/* Stat highlight */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-brand">
          {stat}
        </span>
        <span className="text-[12px] font-medium text-muted-foreground">
          {statLabel}
        </span>
      </div>

      {/* Quote icon */}
      <QuoteIcon className="size-4 text-brand/40 shrink-0" />

      {/* Quote text */}
      <blockquote className="flex-1">
        <p className="text-[14px] leading-relaxed text-foreground/80">
          {quote}
        </p>
      </blockquote>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Author */}
      <div className="flex items-center gap-3">
        {/* Avatar circle with initials */}
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${color.bg} ${color.text} text-[11px] font-semibold tracking-wide select-none`}
          aria-label={`Avatar for ${name}`}
        >
          {initials}
        </div>

        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground truncate">
            {name}
          </p>
          <p className="text-[12px] text-muted-foreground truncate">
            {role}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────

export function Testimonials() {
  return (
    <section
      id="testimonials"
      className="py-24 sm:py-32 bg-background"
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">

        {/* — Heading — */}
        <div className="mx-auto max-w-2xl text-center mb-14 sm:mb-16">
          <p className="text-[13px] font-medium text-brand uppercase tracking-widest mb-3">
            Testimonials
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Loved by restaurant owners
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            See how restaurants are growing repeat business with Fidelio
          </p>
        </div>

        {/* — Grid: 2 rows x 3 columns — */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <TestimonialCard
              key={testimonial.name}
              name={testimonial.name}
              role={testimonial.role}
              quote={testimonial.quote}
              stat={testimonial.stat}
              statLabel={testimonial.statLabel}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
