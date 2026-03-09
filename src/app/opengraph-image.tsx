import { ImageResponse } from "next/og"

export const runtime = undefined
export const alt = "Loyalshy — Digital Loyalty Cards for Businesses"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            marginBottom: 32,
          }}
        >
          <span style={{ fontSize: 40, color: "white", fontWeight: 700 }}>L</span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "white",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Loyalshy
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 24,
            color: "#a1a1aa",
            margin: "16px 0 0",
            maxWidth: 600,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Digital loyalty cards with Apple &amp; Google Wallet passes for businesses
        </p>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 40,
          }}
        >
          {["QR Onboarding", "Wallet Passes", "Real-time Analytics"].map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 20px",
                borderRadius: 999,
                border: "1px solid #333",
                color: "#d4d4d8",
                fontSize: 16,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
