import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  serverExternalPackages: ["passkit-generator", "sharp"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-7c8a43a8edf44acb9ce148cb7547aa00.r2.dev",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Only upload source maps when SENTRY_AUTH_TOKEN is set
  silent: !process.env.SENTRY_AUTH_TOKEN,

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
