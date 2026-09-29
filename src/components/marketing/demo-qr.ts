import QRCode from "qrcode"

// One QR for every mock on the landing: the demo join page when it is
// configured, the site otherwise. Rendered on the server as a data URL,
// transparent background so it sits on any surface.
export async function demoQrDataUrl(dark = "#1F1410"): Promise<string> {
  // Cached: with cacheComponents, an un-cached async step in a server
  // component is treated as dynamic IO and pushes the page out of prerender.
  "use cache"
  const url = process.env.NEXT_PUBLIC_DEMO_JOIN_URL ?? "https://loyalshy.com"
  return QRCode.toDataURL(url, { margin: 0, width: 512, color: { dark, light: "#00000000" } })
}
