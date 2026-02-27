import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring sample rate (0.0 to 1.0)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session replay (captures user interactions on error)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Only send errors in production
  beforeSend(event) {
    if (process.env.NODE_ENV !== "production") return null
    return event
  },
})
