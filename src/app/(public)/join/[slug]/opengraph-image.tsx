import { ImageResponse } from "next/og"
import { getOrganizationBySlug } from "@/server/onboarding-actions"

export const alt = "Join the loyalty program"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const CORAL = "#FF6B47"
const CREAM = "#FFF8F1"
const INK = "#1F1410"

/** Satori (next/og) doesn't render oklch(). Allow hex / rgb / hsl; otherwise fall back. */
function safeColor(color: string | null | undefined, fallback: string): string {
  if (!color) return fallback
  const c = color.trim().toLowerCase()
  if (c.startsWith("#") || c.startsWith("rgb") || c.startsWith("hsl")) return color
  return fallback
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const org = await getOrganizationBySlug(slug)

  const firstTemplate = org?.templates?.[0] ?? null
  const brand = safeColor(
    firstTemplate?.passDesign?.primaryColor ?? org?.brandColor ?? null,
    CORAL
  )
  const orgName = org?.name ?? "Loyalshy"
  const programName = firstTemplate?.name ?? null
  const logoUrl = org?.logoGoogle ?? org?.logo ?? null
  const initial = orgName.trim().charAt(0).toUpperCase() || "L"

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: CREAM,
          backgroundImage: `linear-gradient(135deg, ${brand}22 0%, ${CREAM} 55%, ${CREAM} 100%)`,
          padding: 80,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          color: INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              width={112}
              height={112}
              style={{
                width: 112,
                height: 112,
                borderRadius: 24,
                objectFit: "cover",
                border: `2px solid ${brand}33`,
              }}
            />
          ) : (
            <div
              style={{
                width: 112,
                height: 112,
                borderRadius: 24,
                backgroundColor: brand,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 56,
                fontWeight: 700,
              }}
            >
              {initial}
            </div>
          )}
          <div
            style={{
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: INK,
            }}
          >
            {orgName}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {programName && (
            <div
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 22,
                paddingRight: 22,
                borderRadius: 9999,
                backgroundColor: `${brand}1a`,
                color: brand,
                fontSize: 26,
                fontWeight: 600,
              }}
            >
              {programName}
            </div>
          )}
          <div
            style={{
              fontSize: 88,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: INK,
              maxWidth: 1000,
            }}
          >
            Join the loyalty program
          </div>
          <div
            style={{
              fontSize: 32,
              color: `${INK}cc`,
              fontWeight: 400,
              maxWidth: 1000,
            }}
          >
            Scan, save to your wallet, start earning rewards.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 56,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: `${INK}99`,
              fontSize: 22,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 9999,
                backgroundColor: brand,
              }}
            />
            Powered by Loyalshy
          </div>
          <div style={{ color: `${INK}66`, fontSize: 22 }}>loyalshy.com</div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
