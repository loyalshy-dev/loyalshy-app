"use client"

import QRCode from "qrcode"
import { renderStyledQr } from "@/components/styled-qr-code"

// ─── Print pieces drawn on a canvas ──────────────────────────
// The counter card (A6) and the table tent (A4 folded in two) as 300 dpi
// bitmaps that jsPDF places on the page. Everything is drawn on canvas —
// text included, in the page's own font — so the PDF needs no embedded
// fonts and the tent's upper face can simply be rotated 180°.

const DPI = 300
const MM = DPI / 25.4
export const A6 = { w: 105, h: 148 }
export const A5_LANDSCAPE = { w: 210, h: 148 }
export const A4 = { w: 210, h: 297 }

export type FaceSpec = {
  accent: string
  businessName: string
  title: string
  line: string
  footer: string
  qrValue: string
  qrLogoText: string
  qrLogoUrl: string | null
}

function pageFont(): string {
  const family = typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "sans-serif"
  return family || "sans-serif"
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject()
      img.src = src
    })
    return img
  } catch {
    return null
  }
}

/** The styled QR (brand color, logo in the middle) as an image, `size` px square. */
export async function renderQrImage(value: string, size: number, accent: string, logoText: string, logoUrl: string | null): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  const qr = QRCode.create(value, { errorCorrectionLevel: "H" })
  const svg = renderStyledQr(qr.modules, size, logoText, { bg: accent, fg: "#ffffff" })
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
  const qrImage = await loadImage(url)
  URL.revokeObjectURL(url)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, size, size)
  if (qrImage) ctx.drawImage(qrImage, 0, 0, size, size)

  if (logoUrl) {
    const logo = await loadImage(`/api/image-proxy?url=${encodeURIComponent(logoUrl)}`)
    if (logo) {
      const moduleCount = qr.modules.size
      const cellSize = size / (moduleCount + 5)
      const radius = Math.ceil(moduleCount * 0.18) * cellSize * 0.42
      const c = size / 2
      ctx.save()
      ctx.beginPath()
      ctx.arc(c, c, radius + 1, 0, Math.PI * 2)
      ctx.fillStyle = accent
      ctx.fill()
      ctx.beginPath()
      ctx.arc(c, c, radius, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(logo, c - radius, c - radius, radius * 2, radius * 2)
      ctx.restore()
    }
  }
  return canvas
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
  return y + lines.length * lineHeight
}

/**
 * One face: accent band, business name, title, the QR, one line, footer.
 * `w`/`h` in mm; drawn into `ctx` at (0,0) in px; `rotate` turns it 180°
 * for the tent's upper half.
 */
export async function drawFace(ctx: CanvasRenderingContext2D, spec: FaceSpec, wMm: number, hMm: number, rotate = false) {
  const w = Math.round(wMm * MM)
  const h = Math.round(hMm * MM)
  const font = pageFont()
  ctx.save()
  if (rotate) {
    ctx.translate(w, h)
    ctx.rotate(Math.PI)
  }
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = spec.accent
  ctx.fillRect(0, 0, w, Math.round(6 * MM))

  const landscape = w > h
  const qrSize = Math.round((landscape ? hMm * 0.5 : wMm * 0.56) * MM)
  const textMax = w - Math.round(16 * MM)
  const cx = w / 2
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#1F1410"

  const nameSize = Math.round((landscape ? 8 : 7) * MM)
  ctx.font = `700 ${nameSize}px ${font}`
  let y = Math.round((landscape ? 22 : 24) * MM)
  y = drawLines(ctx, wrap(ctx, spec.businessName, textMax).slice(0, 2), cx, y, nameSize * 1.15)

  ctx.font = `400 ${Math.round(4.2 * MM)}px ${font}`
  ctx.fillStyle = "#5a4f4a"
  y = drawLines(ctx, wrap(ctx, spec.title, textMax).slice(0, 1), cx, y + Math.round(1 * MM), Math.round(5 * MM))

  const qrY = y + Math.round(4 * MM)
  const qrCanvas = await renderQrImage(spec.qrValue, qrSize, spec.accent, spec.qrLogoText, spec.qrLogoUrl)
  ctx.drawImage(qrCanvas, cx - qrSize / 2, qrY, qrSize, qrSize)

  ctx.fillStyle = "#1F1410"
  const lineSize = Math.round(4.6 * MM)
  ctx.font = `500 ${lineSize}px ${font}`
  drawLines(ctx, wrap(ctx, spec.line, textMax).slice(0, 2), cx, qrY + qrSize + Math.round(9 * MM), lineSize * 1.25)

  ctx.fillStyle = "#9b918c"
  ctx.font = `400 ${Math.round(3 * MM)}px ${font}`
  ctx.fillText(spec.footer, cx, h - Math.round(7 * MM))
  ctx.restore()
}

// JPEG at 0.92: a 300 dpi A4 PNG is ~15 MB, the JPEG under 1 MB, and the QR
// stays crisp.
const JPEG_QUALITY = 0.92

/** A6 portrait card → JPEG data URL at 300 dpi. */
export async function renderCounterCard(spec: FaceSpec): Promise<string> {
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(A6.w * MM)
  canvas.height = Math.round(A6.h * MM)
  await drawFace(canvas.getContext("2d")!, spec, A6.w, A6.h)
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY)
}

/**
 * A4 portrait sheet with two A5-landscape faces: the upper one rotated so
 * both read upright once the sheet is folded into a tent. Returns the JPEG
 * plus the fold position in mm.
 */
export async function renderTableTent(front: FaceSpec, back: FaceSpec, foldLabel: string): Promise<{ dataUrl: string; foldMm: number }> {
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(A4.w * MM)
  canvas.height = Math.round(A4.h * MM)
  const ctx = canvas.getContext("2d")!
  const faceH = Math.round(A5_LANDSCAPE.h * MM)
  // Upper face, upside down
  ctx.save()
  await drawFace(ctx, back, A5_LANDSCAPE.w, A5_LANDSCAPE.h, true)
  ctx.restore()
  // Lower face
  ctx.save()
  ctx.translate(0, canvas.height - faceH)
  await drawFace(ctx, front, A5_LANDSCAPE.w, A5_LANDSCAPE.h)
  ctx.restore()
  // Fold line in the strip between the faces
  const foldY = canvas.height / 2
  ctx.save()
  ctx.strokeStyle = "#c9c2bd"
  ctx.lineWidth = Math.max(2, MM * 0.25)
  ctx.setLineDash([MM * 2, MM * 2])
  ctx.beginPath()
  ctx.moveTo(0, foldY)
  ctx.lineTo(canvas.width, foldY)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = "#9b918c"
  ctx.font = `400 ${Math.round(2.6 * MM)}px ${pageFont()}`
  ctx.textAlign = "left"
  ctx.fillText(foldLabel, Math.round(4 * MM), foldY - Math.round(1.5 * MM))
  ctx.restore()
  return { dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY), foldMm: A4.h / 2 }
}
