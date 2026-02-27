import type { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://fidelio.app"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/join/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
