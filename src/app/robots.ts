import type { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://loyalshy.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/v1/docs"],
        disallow: ["/dashboard/", "/api/", "/join/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
