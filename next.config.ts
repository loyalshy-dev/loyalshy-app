import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import { defaultLocale, locales } from "./src/i18n/config";
import { MARKETING_PATHS } from "./src/i18n/marketing";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Report-only first: Sentry/devtools show what it would block. Promote to
  // Content-Security-Policy once a week of traffic shows no violations.
  // Origins actually used on the marketing pages: Unsplash photos, the R2
  // bucket (logos), Sentry ingest, Plausible when enabled.
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://plausible.io",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob: https://images.unsplash.com https://pub-7c8a43a8edf44acb9ce148cb7547aa00.r2.dev https://*.tile.openstreetmap.org",
      "connect-src 'self' https://*.ingest.sentry.io https://*.sentry.io https://plausible.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

// Files in /public are not content-hashed, so a day in the browser plus a
// week of stale-while-revalidate; rename a file when it changes.
const staticAssetHeaders = [
  { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
];

// ─── Marketing locale routing (see src/i18n/marketing.ts) ────
// English marketing pages keep their unprefixed URLs (/, /contact, …) and
// are served by src/app/[locale] through rewrites; /en/* redirects to them.
// "/"-style URLs send visitors to /es or /fr when their `locale` cookie
// says so, or — with no cookie — when their browser's primary language
// does. Crawlers send neither, so they always get English plus hreflang.
const prefixedLocales = locales.filter((l) => l !== defaultLocale);

function marketingRewrites() {
  return MARKETING_PATHS.map((path) => ({
    source: path,
    destination: path === "/" ? `/${defaultLocale}` : `/${defaultLocale}${path}`,
  }));
}

function marketingRedirects() {
  const toEnglish = [
    { source: `/${defaultLocale}`, destination: "/", permanent: true },
    { source: `/${defaultLocale}/:path*`, destination: "/:path*", permanent: true },
  ];
  const toPreferred = MARKETING_PATHS.flatMap((path) =>
    prefixedLocales.flatMap((locale) => {
      const destination = path === "/" ? `/${locale}` : `/${locale}${path}`;
      return [
        {
          source: path,
          has: [{ type: "cookie" as const, key: "locale", value: locale }],
          destination,
          permanent: false,
        },
        {
          source: path,
          missing: [{ type: "cookie" as const, key: "locale" }],
          has: [{ type: "header" as const, key: "accept-language", value: `${locale}(?:[-_;,].*)?` }],
          destination,
          permanent: false,
        },
      ];
    })
  );
  return [...toEnglish, ...toPreferred];
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  serverExternalPackages: ["passkit-generator", "sharp"],
  experimental: {
    // Two root layouts ((app) and [locale]) — unmatched URLs need a
    // layout-independent 404: src/app/global-not-found.tsx.
    globalNotFound: true,
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    // Optimized images were sent with max-age=0 (the upstream /public files
    // have no cache header); a month in the browser is right for assets
    // that only change with a deploy.
    minimumCacheTTL: 2592000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-7c8a43a8edf44acb9ce148cb7547aa00.r2.dev",
      },
    ],
  },
  async redirects() {
    return marketingRedirects();
  },
  async rewrites() {
    return { beforeFiles: marketingRewrites(), afterFiles: [], fallback: [] };
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/:path*.(webp|png|jpg|jpeg|svg|ico|woff2)",
        headers: staticAssetHeaders,
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // Only upload source maps when SENTRY_AUTH_TOKEN is set
  silent: !process.env.SENTRY_AUTH_TOKEN,

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
