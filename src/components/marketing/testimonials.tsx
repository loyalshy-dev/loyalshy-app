import { getTranslations } from "next-intl/server"
import { FadeIn, Stagger, StaggerItem } from "./motion"

/* ─── Avatar colors ───────────────────────────────────────────────── */

const AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: "oklch(0.55 0.22 265 / 0.12)", text: "oklch(0.50 0.20 265)" },
  { bg: "oklch(0.60 0.15 185 / 0.12)", text: "oklch(0.50 0.13 185)" },
  { bg: "oklch(0.65 0.12 145 / 0.12)", text: "oklch(0.48 0.12 145)" },
  { bg: "oklch(0.70 0.14 75 / 0.12)", text: "oklch(0.55 0.14 75)" },
  { bg: "oklch(0.60 0.18 330 / 0.12)", text: "oklch(0.50 0.16 330)" },
  { bg: "oklch(0.704 0.193 32 / 0.12)", text: "oklch(0.66 0.18 32)" },
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

/* ─── Data ────────────────────────────────────────────────────────── */

const TESTIMONIAL_KEYS = [
  "maria",
  "james",
  "sophie",
  "luca",
  "aisha",
  "thomas",
] as const

/* ─── Star rating ─────────────────────────────────────────────────── */

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="oklch(0.75 0.15 85)"
        >
          <path d="M7 1l1.8 3.6L13 5.3l-3 2.9.7 4.1L7 10.4 3.3 12.3l.7-4.1-3-2.9 4.2-.7L7 1z" />
        </svg>
      ))}
    </div>
  )
}

/* ─── Quote icon ──────────────────────────────────────────────────── */

function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="16"
      viewBox="0 0 20 16"
      fill="currentColor"
      className={className}
      style={{ color: "oklch(0.704 0.193 32 / 0.2)" }}
    >
      <path d="M0 16V9.5C0 5.9 2.3 2.9 6.9 0l1.4 1.8C5.8 3.3 4.4 5.2 4 8h3.5V16H0zm10 0V9.5C10 5.9 12.3 2.9 16.9 0l1.4 1.8C15.8 3.3 14.4 5.2 14 8h3.5V16H10z" />
    </svg>
  )
}

/* ─── Standard card ──────────────────────────────────────────────── */

type TestimonialData = {
  name: string
  role: string
  quote: string
  stat: string
  statLabel: string
  avatarAlt: string
  stars: number
}

function TestimonialCard({ name, role, quote, stat, statLabel, avatarAlt, stars }: TestimonialData) {
  const color = getAvatarColor(name)
  const initials = getInitials(name)

  return (
    <div
      className="flex flex-col gap-5 p-6 rounded-2xl transition-all duration-250 hover:-translate-y-0.5"
      style={{
        background: "var(--mk-card)",
        border: "1px solid var(--mk-border)",
        boxShadow: "0 1px 3px oklch(0 0 0 / 0.06), 0 4px 16px oklch(0 0 0 / 0.04)",
      }}
    >
      {/* Stat + stars */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="mk-gradient-text text-2xl font-bold tracking-tight">
            {stat}
          </span>
          <span
            className="text-[12px] font-medium"
            style={{ color: "var(--mk-text-dimmed)" }}
          >
            {statLabel}
          </span>
        </div>
        <Stars count={stars} />
      </div>

      <QuoteIcon />

      <blockquote className="flex-1">
        <p
          className="text-[14px] leading-relaxed"
          style={{ color: "var(--mk-text-muted)" }}
        >
          &ldquo;{quote}&rdquo;
        </p>
      </blockquote>

      <div className="h-px" style={{ background: "var(--mk-border)" }} />

      {/* Author */}
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tracking-wide select-none"
          style={{ background: color.bg, color: color.text }}
          aria-label={avatarAlt}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p
            className="text-[14px] font-semibold truncate"
            style={{ color: "var(--mk-text)" }}
          >
            {name}
          </p>
          <p
            className="text-[13px] truncate"
            style={{ color: "var(--mk-text-dimmed)" }}
          >
            {role}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Featured card (full width, larger) ─────────────────────────── */

function FeaturedTestimonialCard({ name, role, quote, stat, statLabel, avatarAlt, stars }: TestimonialData) {
  const color = getAvatarColor(name)
  const initials = getInitials(name)

  return (
    <div
      className="relative flex flex-col gap-6 p-8 sm:p-10 rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, oklch(0.704 0.193 32 / 0.04), oklch(0.704 0.193 32 / 0.03))",
        border: "1px solid oklch(0.704 0.193 32 / 0.12)",
        boxShadow: "0 4px 24px oklch(0 0 0 / 0.06), 0 0 60px oklch(0.704 0.193 32 / 0.03)",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-full text-[16px] font-bold tracking-wide select-none"
            style={{ background: color.bg, color: color.text }}
            aria-label={avatarAlt}
          >
            {initials}
          </div>
          <div>
            <p
              className="text-[16px] font-semibold"
              style={{ color: "var(--mk-text)" }}
            >
              {name}
            </p>
            <p
              className="text-[14px]"
              style={{ color: "var(--mk-text-dimmed)" }}
            >
              {role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-2">
            <span className="mk-gradient-text text-3xl font-bold tracking-tight">
              {stat}
            </span>
            <span
              className="text-[13px] font-medium"
              style={{ color: "var(--mk-text-dimmed)" }}
            >
              {statLabel}
            </span>
          </div>
          <Stars count={stars} />
        </div>
      </div>

      <QuoteIcon className="size-8" />

      <blockquote>
        <p
          className="text-[17px] sm:text-[19px] leading-relaxed font-medium"
          style={{ color: "var(--mk-text)", letterSpacing: "-0.01em" }}
        >
          &ldquo;{quote}&rdquo;
        </p>
      </blockquote>
    </div>
  )
}

/* ─── Section ─────────────────────────────────────────────────────── */

export async function Testimonials() {
  const t = await getTranslations("testimonials")

  const testimonials = TESTIMONIAL_KEYS.map((key) => ({
    key,
    name: t(`items.${key}.name`),
    role: t(`items.${key}.role`),
    stat: t(`items.${key}.stat`),
    statLabel: t(`items.${key}.statLabel`),
    quote: t(`items.${key}.quote`),
    avatarAlt: t("avatarAlt", { name: t(`items.${key}.name`) }),
    stars: 5,
  }))

  const [featured, ...rest] = testimonials

  return (
    <section
      id="testimonials"
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{ background: "var(--mk-bg)" }}
    >
      {/* Gradient mesh */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 50% 40% at 50% 30%, oklch(0.704 0.193 32 / 0.04) 0%, transparent 70%)
          `,
        }}
      />

      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center mb-14 sm:mb-16">
            <p
              className="text-[13px] font-medium tracking-wide mb-3"
              style={{ color: "var(--mk-brand-purple)" }}
            >
              {t("sectionLabel")}
            </p>
            <h2
              className="text-3xl sm:text-[2.75rem] font-bold"
              style={{ color: "var(--mk-text)", letterSpacing: "-0.035em" }}
            >
              {t("title")}
            </h2>
            <p
              className="mt-4 text-[16px] leading-relaxed"
              style={{ color: "var(--mk-text-muted)" }}
            >
              {t("subtitle")}
            </p>
          </div>
        </FadeIn>

        {/* Featured testimonial */}
        <FadeIn>
          <FeaturedTestimonialCard {...featured} />
        </FadeIn>

        {/* Remaining testimonials in staggered grid */}
        <Stagger
          className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.08}
        >
          {rest.map(({ key, ...props }) => (
            <StaggerItem key={key}>
              <TestimonialCard {...props} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
