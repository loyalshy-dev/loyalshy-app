/**
 * Generate bundled strip images for card templates.
 * Run: pnpm tsx scripts/generate-template-images.ts
 */
import sharp from "sharp"
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, "../public/templates")
mkdirSync(OUT_DIR, { recursive: true })

const APPLE_W = 1125
const APPLE_H = 432
const GOOGLE_W = 1032
const GOOGLE_H = 336

function darkTextureSvg(w: number, h: number): string {
  // Dark marble-like texture for fine-noir
  const rects: string[] = []
  const step = 20
  for (let x = 0; x < w; x += step) {
    for (let y = 0; y < h; y += step) {
      const shade = 8 + Math.floor(Math.random() * 18)
      rects.push(`<rect x="${x}" y="${y}" width="${step}" height="${step}" fill="rgb(${shade},${shade},${shade + 2})" />`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="#0a0a0a" />
    ${rects.join("")}
    <rect width="${w}" height="${h}" fill="url(#overlay)" />
    <defs>
      <linearGradient id="overlay" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1a1a2e" stop-opacity="0.4" />
        <stop offset="50%" stop-color="#000000" stop-opacity="0.1" />
        <stop offset="100%" stop-color="#2a1a1a" stop-opacity="0.3" />
      </linearGradient>
    </defs>
  </svg>`
}

function neonBarSvg(w: number, h: number): string {
  // Moody dark bar with neon glow accents
  const lines: string[] = []
  for (let i = 0; i < 6; i++) {
    const y = 40 + Math.floor(Math.random() * (h - 80))
    const x = Math.floor(Math.random() * (w - 200))
    const len = 100 + Math.floor(Math.random() * 200)
    const colors = ["#e040fb", "#7c4dff", "#00e5ff", "#e040fb"]
    const color = colors[i % colors.length]
    lines.push(`<line x1="${x}" y1="${y}" x2="${x + len}" y2="${y}" stroke="${color}" stroke-width="2" opacity="0.6" />`)
    lines.push(`<line x1="${x}" y1="${y}" x2="${x + len}" y2="${y}" stroke="${color}" stroke-width="8" opacity="0.08" />`)
  }
  // Ambient circles for glow
  const circles: string[] = []
  for (let i = 0; i < 4; i++) {
    const cx = 100 + Math.floor(Math.random() * (w - 200))
    const cy = 50 + Math.floor(Math.random() * (h - 100))
    const r = 60 + Math.floor(Math.random() * 80)
    circles.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#e040fb" opacity="0.04" />`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="#0d0d0d" />
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1a0a2e" stop-opacity="0.6" />
        <stop offset="100%" stop-color="#0d0d0d" stop-opacity="1" />
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)" />
    ${circles.join("")}
    ${lines.join("")}
  </svg>`
}

async function generate(name: string, svgFn: (w: number, h: number) => string) {
  const appleSvg = svgFn(APPLE_W, APPLE_H)
  const googleSvg = svgFn(GOOGLE_W, GOOGLE_H)

  const [appleBuf, googleBuf] = await Promise.all([
    sharp(Buffer.from(appleSvg)).resize(APPLE_W, APPLE_H).jpeg({ quality: 85 }).toBuffer(),
    sharp(Buffer.from(googleSvg)).resize(GOOGLE_W, GOOGLE_H).jpeg({ quality: 85 }).toBuffer(),
  ])

  writeFileSync(join(OUT_DIR, `${name}-apple.jpg`), appleBuf)
  writeFileSync(join(OUT_DIR, `${name}-google.jpg`), googleBuf)
  console.log(`Generated: ${name}-apple.jpg (${(appleBuf.length / 1024).toFixed(1)}KB), ${name}-google.jpg (${(googleBuf.length / 1024).toFixed(1)}KB)`)
}

async function main() {
  await generate("fine-noir", darkTextureSvg)
  await generate("bar-neon", neonBarSvg)
  console.log("Done!")
}

main().catch(console.error)
