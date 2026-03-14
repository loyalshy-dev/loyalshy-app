import type { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: "2026-03-14",
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: "2026-03-14",
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: "2026-03-14",
    },
    {
      url: `${siteUrl}/cookies`,
      lastModified: "2026-03-14",
    },
    {
      url: `${siteUrl}/api/v1/docs`,
      lastModified: "2026-03-14",
    },
  ]
}
