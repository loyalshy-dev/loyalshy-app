import Script from "next/script"

/**
 * Analytics provider component — renders Plausible analytics script
 * when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set.
 *
 * Add to root layout: <AnalyticsProvider />
 *
 * Custom events can be tracked from client components:
 *   window.plausible?.("signup", { props: { plan: "starter" } })
 */
export function AnalyticsProvider() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN

  if (!domain) return null

  const src =
    process.env.NEXT_PUBLIC_PLAUSIBLE_HOST
      ? `${process.env.NEXT_PUBLIC_PLAUSIBLE_HOST}/js/script.js`
      : "https://plausible.io/js/script.js"

  return (
    <Script
      defer
      data-domain={domain}
      src={src}
      strategy="afterInteractive"
    />
  )
}
