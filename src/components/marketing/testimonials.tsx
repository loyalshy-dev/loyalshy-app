// ─── Avatar Color Palette ──────────────────────────────────
const AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: "oklch(0.55 0.22 265 / 0.12)", text: "oklch(0.50 0.20 265)" },
  { bg: "oklch(0.60 0.15 185 / 0.12)", text: "oklch(0.50 0.13 185)" },
  { bg: "oklch(0.65 0.12 145 / 0.12)", text: "oklch(0.48 0.12 145)" },
  { bg: "oklch(0.70 0.14 75 / 0.12)",  text: "oklch(0.55 0.14 75)" },
  { bg: "oklch(0.60 0.18 330 / 0.12)", text: "oklch(0.50 0.16 330)" },
  { bg: "oklch(0.55 0.2 265 / 0.12)",  text: "oklch(0.50 0.18 265)" },
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
      "Our redemption rate went from 15% with paper cards to 92% with Loyalshy. Digital passes actually get used because they're always in the customer's phone.",
  },
  {
    name: "Thomas Bergström",
    role: "Owner, Nordic Kitchen",
    stat: "2 hrs",
    statLabel: "saved per week",
    quote:
      "We used to spend hours managing punch cards and tracking rewards manually. Loyalshy automated everything. My staff can focus on what matters — great food.",
  },
] as const

function QuoteIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="16"
      viewBox="0 0 20 16"
      fill="currentColor"
      className={className}
      style={style}
    >
      <path d="M0 16V9.5C0 5.9 2.3 2.9 6.9 0l1.4 1.8C5.8 3.3 4.4 5.2 4 8h3.5V16H0zm10 0V9.5C10 5.9 12.3 2.9 16.9 0l1.4 1.8C15.8 3.3 14.4 5.2 14 8h3.5V16H10z" />
    </svg>
  )
}

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
    <div className="mk-card-glass flex flex-col gap-5 p-6">
      {/* Stat highlight */}
      <div className="flex items-baseline gap-2">
        <span className="mk-gradient-text text-2xl font-bold tracking-tight">
          {stat}
        </span>
        <span className="text-[12px] font-medium" style={{ color: "var(--mk-text-dimmed)" }}>
          {statLabel}
        </span>
      </div>

      <QuoteIcon className="size-4 shrink-0" style={{ color: "oklch(0.55 0.2 265 / 0.3)" }} />

      <blockquote className="flex-1">
        <p className="text-[14px] leading-relaxed" style={{ color: "var(--mk-text-muted)" }}>
          {quote}
        </p>
      </blockquote>

      <div className="h-px" style={{ background: "var(--mk-border)" }} />

      <div className="flex items-center gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide select-none"
          style={{ background: color.bg, color: color.text }}
          aria-label={`Avatar for ${name}`}
        >
          {initials}
        </div>

        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate" style={{ color: "var(--mk-text)" }}>
            {name}
          </p>
          <p className="text-[12px] truncate" style={{ color: "var(--mk-text-dimmed)" }}>
            {role}
          </p>
        </div>
      </div>
    </div>
  )
}

export function Testimonials() {
  return (
    <section
      id="testimonials"
      className="py-24 sm:py-32"
      style={{ background: "var(--mk-bg)" }}
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-14 sm:mb-16">
          <p
            className="text-[13px] font-medium uppercase tracking-widest mb-3"
            style={{ color: "var(--mk-brand-purple)" }}
          >
            Testimonials
          </p>
          <h2
            className="text-3xl sm:text-4xl font-semibold"
            style={{ color: "var(--mk-text)", letterSpacing: "-0.025em" }}
          >
            Loved by business owners
          </h2>
          <p
            className="mt-4 text-[15px] leading-relaxed"
            style={{ color: "var(--mk-text-muted)" }}
          >
            See how businesses are growing repeat customers with Loyalshy
          </p>
        </div>

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
