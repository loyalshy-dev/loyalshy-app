import { useState, useCallback, useEffect, useRef, useMemo } from "react";

/*
 * ═══════════════════════════════════════════════════════════════════
 *  WALLET STUDIO PRO — Professional Fidelity Card Editor
 *  Supports Apple Wallet (.pkpass) & Google Wallet (JWT) formats
 * ═══════════════════════════════════════════════════════════════════
 */

// ─── CONSTANTS ─────────────────────────────────────────────────────

const CARD_FORMATS = {
  apple: { w: 320, h: 428, label: "Apple Wallet", ratio: "~3:4", icon: "🍎" },
  google: { w: 340, h: 440, label: "Google Wallet", ratio: "~3:4", icon: "🤖" },
  square: { w: 340, h: 340, label: "Square", ratio: "1:1", icon: "⬜" },
  wide: { w: 380, h: 260, label: "Wide", ratio: "3:2", icon: "▬" },
};

const CARD_TYPES = [
  { id: "stamp", label: "Stamp Card", icon: "🎯", desc: "Collect stamps for rewards" },
  { id: "points", label: "Points", icon: "⭐", desc: "Accumulate loyalty points" },
  { id: "tier", label: "Tier / VIP", icon: "👑", desc: "Membership tiers" },
  { id: "coupon", label: "Coupon", icon: "🎟️", desc: "Discount or offer" },
];

const STAMP_EMOJI_PRESETS = [
  { id: "burger", emoji: "🍔" }, { id: "pizza", emoji: "🍕" },
  { id: "coffee", emoji: "☕" }, { id: "star", emoji: "⭐" },
  { id: "heart", emoji: "❤️" }, { id: "check", emoji: "✓" },
  { id: "donut", emoji: "🍩" }, { id: "ice", emoji: "🍦" },
  { id: "taco", emoji: "🌮" }, { id: "sushi", emoji: "🍣" },
  { id: "cake", emoji: "🎂" }, { id: "beer", emoji: "🍺" },
  { id: "wine", emoji: "🍷" }, { id: "cookie", emoji: "🍪" },
  { id: "croissant", emoji: "🥐" },
];

// Stamp content mode: emoji fallback or image URL
const STAMP_CONTENT_MODES = [
  { id: "emoji", label: "Emoji" },
  { id: "image", label: "Image URL" },
];

const STAMP_SHAPES = [
  { id: "circle", label: "Circle", radius: "50%" },
  { id: "rounded", label: "Rounded", radius: "25%" },
  { id: "square", label: "Square", radius: "4px" },
  { id: "hexagon", label: "Hexagon", radius: "50%" },
  { id: "diamond", label: "Diamond", radius: "4px" },
];

const STAMP_STYLES = [
  { id: "filled", label: "Filled" },
  { id: "outlined", label: "Outlined" },
  { id: "ghost", label: "Ghost" },
  { id: "glow", label: "Glow" },
];

const PLACEHOLDER_STYLES = [
  { id: "number", label: "Numbers" },
  { id: "dot", label: "Dot" },
  { id: "dash", label: "Dash" },
  { id: "empty", label: "Empty" },
  { id: "dimmed", label: "Dimmed Icon" },
  { id: "outline", label: "Icon Outline" },
];

const CODE_TYPES = [
  { id: "qr", label: "QR Code" },
  { id: "barcode128", label: "Code 128" },
  { id: "pdf417", label: "PDF417" },
  { id: "aztec", label: "Aztec" },
  { id: "ean13", label: "EAN-13" },
  { id: "none", label: "None" },
];

const CUTOUT_STYLES = [
  { id: "none", label: "None" },
  { id: "semicircle", label: "Semicircle" },
  { id: "ticket", label: "Ticket Tear" },
  { id: "zigzag", label: "Zigzag" },
  { id: "wave", label: "Wave" },
  { id: "dotted", label: "Dotted Line" },
];

const PRESET_THEMES = [
  { id: "midnight", label: "Midnight", bg: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)", text: "#ffffff", accent: "#a78bfa" },
  { id: "sunset", label: "Sunset", bg: "linear-gradient(135deg, #f97316, #ec4899, #8b5cf6)", text: "#ffffff", accent: "#fbbf24" },
  { id: "ocean", label: "Ocean", bg: "linear-gradient(135deg, #0ea5e9, #2563eb, #1e40af)", text: "#ffffff", accent: "#38bdf8" },
  { id: "forest", label: "Forest", bg: "linear-gradient(135deg, #065f46, #047857, #10b981)", text: "#ffffff", accent: "#6ee7b7" },
  { id: "lona", label: "Bold Brand", bg: "linear-gradient(160deg, #1a1464, #2d1b8e, #1a1464)", text: "#ffffff", accent: "#ef4444" },
  { id: "cream", label: "Cream", bg: "linear-gradient(135deg, #fef3c7, #fde68a, #fbbf24)", text: "#1c1917", accent: "#d97706" },
  { id: "noir", label: "Noir", bg: "linear-gradient(135deg, #18181b, #27272a, #3f3f46)", text: "#fafafa", accent: "#f59e0b" },
  { id: "rose", label: "Rosé", bg: "linear-gradient(135deg, #9f1239, #be185d, #ec4899)", text: "#ffffff", accent: "#fda4af" },
  { id: "arctic", label: "Arctic", bg: "linear-gradient(135deg, #e0f2fe, #bae6fd, #7dd3fc)", text: "#0c4a6e", accent: "#0284c7" },
  { id: "ember", label: "Ember", bg: "linear-gradient(135deg, #431407, #7c2d12, #c2410c)", text: "#fff7ed", accent: "#fb923c" },
  { id: "lavender", label: "Lavender", bg: "linear-gradient(135deg, #4c1d95, #6d28d9, #8b5cf6)", text: "#ffffff", accent: "#c4b5fd" },
  { id: "slate", label: "Slate", bg: "linear-gradient(135deg, #1e293b, #334155, #475569)", text: "#f1f5f9", accent: "#38bdf8" },
];

const FONT_OPTIONS = [
  "Poppins", "Montserrat", "Playfair Display", "Bebas Neue", "Oswald",
  "Raleway", "Lora", "Archivo Black", "DM Sans", "Sora", "Outfit",
  "Bitter", "Cabin", "Quicksand", "Nunito", "Merriweather",
  "Rubik", "Karla", "Manrope", "Plus Jakarta Sans",
];

const BG_PATTERNS = [
  { id: "none", label: "None" },
  { id: "dots", label: "Dots" },
  { id: "lines", label: "Diagonal Lines" },
  { id: "grid", label: "Grid" },
  { id: "crosses", label: "Crosses" },
  { id: "chevron", label: "Chevron" },
  { id: "circles", label: "Circles" },
  { id: "noise", label: "Noise Grain" },
];

const DEVICES = [
  { id: "none", label: "No Frame" },
  { id: "iphone", label: "iPhone 15" },
  { id: "pixel", label: "Pixel 8" },
  { id: "minimal", label: "Minimal" },
];

// Apple Wallet required assets
const APPLE_ASSETS = [
  { key: "icon", label: "Icon", size: "29×29pt (@1x–3x)", required: true },
  { key: "logo", label: "Logo", size: "160×50pt (@1x–3x)", required: true },
  { key: "strip", label: "Strip Image", size: "375×123pt (@1x–3x)", required: false },
  { key: "thumbnail", label: "Thumbnail", size: "90×90pt (@1x–3x)", required: false },
  { key: "background", label: "Background", size: "180×220pt (@1x–3x)", required: false },
  { key: "footer", label: "Footer", size: "286×15pt (@1x–3x)", required: false },
];

// ─── UTILITIES ─────────────────────────────────────────────────────

function contrastRatio(hex1, hex2) {
  const lum = (hex) => {
    const c = hex.replace("#", "").match(/.{2}/g).map(h => {
      const v = parseInt(h, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const l1 = lum(hex1), l2 = lum(hex2);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return ((lighter + 0.05) / (darker + 0.05)).toFixed(1);
}

function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── QR / BARCODE GENERATORS ───────────────────────────────────────

function generateQRMatrix(data) {
  const size = 25;
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const drawFinder = (ox, oy) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++)
        matrix[oy + y][ox + x] = y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4);
  };
  drawFinder(0, 0); drawFinder(size - 7, 0); drawFinder(0, size - 7);
  for (let i = 8; i < size - 8; i++) { matrix[6][i] = i % 2 === 0; matrix[i][6] = i % 2 === 0; }
  let hash = 0;
  for (let i = 0; i < data.length; i++) hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  for (let y = 9; y < size - 1; y++)
    for (let x = 9; x < size - 1; x++) {
      if (matrix[y][x]) continue;
      hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
      matrix[y][x] = hash % 3 === 0;
    }
  return matrix;
}

function QRCodeSVG({ data = "https://example.com", size = 120, fg = "#000", bg = "#fff", radius = 4, showLogo = false, logoEmoji = "" }) {
  const matrix = generateQRMatrix(data);
  const cellSize = size / matrix.length;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill={bg} rx={radius} />
      {matrix.map((row, y) => row.map((cell, x) => cell && (
        <rect key={`${x}-${y}`} x={x * cellSize + 0.5} y={y * cellSize + 0.5}
          width={cellSize - 0.3} height={cellSize - 0.3} fill={fg} rx={0.4} />
      )))}
      {showLogo && logoEmoji && (
        <g>
          <rect x={size / 2 - 14} y={size / 2 - 14} width={28} height={28} fill={bg} rx={6} />
          <text x={size / 2} y={size / 2 + 6} textAnchor="middle" fontSize={16}>{logoEmoji}</text>
        </g>
      )}
    </svg>
  );
}

function BarcodeSVG({ data = "1234567890", width = 200, height = 56, fg = "#000", bg = "#fff", type = "barcode128", radius = 3 }) {
  let hash = 0;
  for (let i = 0; i < data.length; i++) hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  const bars = [];
  const count = type === "pdf417" ? 80 : type === "ean13" ? 50 : 60;
  for (let i = 0; i < count; i++) {
    hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
    bars.push(hash % 3 === 0 ? 3 : hash % 2 === 0 ? 2 : 1);
  }
  const totalW = bars.reduce((a, b) => a + b + 1, 0);
  const scale = (width - 8) / totalW;
  let x = 0;
  const h = type === "pdf417" ? height * 0.6 : height - 8;
  const rows = type === "pdf417" ? 4 : 1;
  const rowH = h / rows;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect width={width} height={height} fill={bg} rx={radius} />
      {Array.from({ length: rows }).map((_, row) => {
        let cx = 0;
        return bars.map((w, i) => {
          const barX = cx * scale + 4;
          cx += w + 1;
          return (
            <rect key={`${row}-${i}`} x={barX} y={4 + row * rowH} width={w * scale}
              height={rowH - (rows > 1 ? 2 : 0)} fill={fg} rx={0.3} />
          );
        });
      })}
    </svg>
  );
}

function AztecSVG({ data = "test", size = 100, fg = "#000", bg = "#fff", radius = 4 }) {
  const s = 19;
  const matrix = Array.from({ length: s }, () => Array(s).fill(false));
  const c = Math.floor(s / 2);
  for (let r = 0; r < 4; r++) {
    for (let i = c - r * 2; i <= c + r * 2; i++) {
      if (r % 2 === 0) {
        matrix[c - r * 2][i] = true; matrix[c + r * 2][i] = true;
        matrix[i][c - r * 2] = true; matrix[i][c + r * 2] = true;
      }
    }
  }
  matrix[c][c] = true;
  let hash = 0;
  for (let i = 0; i < data.length; i++) hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      if (matrix[y][x]) continue;
      hash = ((hash * 1103515245 + 12345) & 0x7fffffff);
      if (hash % 4 === 0) matrix[y][x] = true;
    }
  const cell = size / s;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill={bg} rx={radius} />
      {matrix.map((row, y) => row.map((v, x) => v && (
        <rect key={`${x}-${y}`} x={x * cell + 0.3} y={y * cell + 0.3}
          width={cell - 0.3} height={cell - 0.3} fill={fg} rx={0.3} />
      )))}
    </svg>
  );
}

// ─── CUTOUT SVG MASKS ──────────────────────────────────────────────

function CutoutOverlay({ style: cutStyle, position, width, height, color }) {
  if (cutStyle === "none") return null;
  const y = position * height;
  const r = 14;

  if (cutStyle === "semicircle") {
    return (
      <svg style={{ position: "absolute", left: 0, top: y - r, width, height: r * 2, pointerEvents: "none", zIndex: 5 }}>
        <circle cx={-2} cy={r} r={r} fill="#09090b" />
        <circle cx={width + 2} cy={r} r={r} fill="#09090b" />
        <line x1={r + 8} y1={r} x2={width - r - 8} y2={r} stroke={hexToRgba(color, 0.15)} strokeWidth={1} strokeDasharray="6 4" />
      </svg>
    );
  }
  if (cutStyle === "ticket") {
    return (
      <svg style={{ position: "absolute", left: 0, top: y - r, width, height: r * 2, pointerEvents: "none", zIndex: 5 }}>
        <circle cx={-2} cy={r} r={r} fill="#09090b" />
        <circle cx={width + 2} cy={r} r={r} fill="#09090b" />
        <line x1={r + 6} y1={r} x2={width - r - 6} y2={r} stroke={hexToRgba(color, 0.2)} strokeWidth={2} strokeDasharray="2 6" strokeLinecap="round" />
      </svg>
    );
  }
  if (cutStyle === "zigzag") {
    const points = [];
    for (let x = 0; x < width; x += 8) points.push(`${x},${x % 16 === 0 ? 0 : 6}`);
    return (
      <svg style={{ position: "absolute", left: 0, top: y - 3, width, height: 8, pointerEvents: "none", zIndex: 5 }}>
        <polyline points={points.join(" ")} fill="none" stroke={hexToRgba(color, 0.2)} strokeWidth={1.5} />
      </svg>
    );
  }
  if (cutStyle === "wave") {
    let d = `M 0 4`;
    for (let x = 0; x < width; x += 20) d += ` Q ${x + 10} -4, ${x + 20} 4`;
    return (
      <svg style={{ position: "absolute", left: 0, top: y - 4, width, height: 10, pointerEvents: "none", zIndex: 5 }}>
        <path d={d} fill="none" stroke={hexToRgba(color, 0.18)} strokeWidth={1.5} />
      </svg>
    );
  }
  if (cutStyle === "dotted") {
    return (
      <svg style={{ position: "absolute", left: 0, top: y, width, height: 2, pointerEvents: "none", zIndex: 5 }}>
        <line x1={16} y1={1} x2={width - 16} y2={1} stroke={hexToRgba(color, 0.2)} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}

// ─── PATTERN GENERATOR ─────────────────────────────────────────────

function getPatternCSS(type, color, opacity = 0.06) {
  const c = hexToRgba(color, opacity);
  switch (type) {
    case "dots": return { backgroundImage: `radial-gradient(circle, ${c} 1px, transparent 1px)`, backgroundSize: "14px 14px" };
    case "lines": return { backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, ${c} 8px, ${c} 9px)` };
    case "grid": return { backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 18px, ${c} 18px, ${c} 19px), repeating-linear-gradient(90deg, transparent, transparent 18px, ${c} 18px, ${c} 19px)` };
    case "crosses": return { backgroundImage: `radial-gradient(circle, ${c} 1px, transparent 1px), radial-gradient(circle, ${c} 1px, transparent 1px)`, backgroundSize: "20px 20px", backgroundPosition: "0 0, 10px 10px" };
    case "chevron": return { backgroundImage: `linear-gradient(135deg, ${c} 25%, transparent 25%), linear-gradient(225deg, ${c} 25%, transparent 25%), linear-gradient(315deg, ${c} 25%, transparent 25%), linear-gradient(45deg, ${c} 25%, transparent 25%)`, backgroundSize: "20px 20px", backgroundPosition: "0 0, 0 0, 0 0, 0 0" };
    case "circles": return { backgroundImage: `radial-gradient(circle, transparent 8px, ${c} 8px, transparent 9px)`, backgroundSize: "24px 24px" };
    case "noise": return { backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`, backgroundSize: "128px 128px", opacity: opacity * 3 };
    default: return {};
  }
}

// ─── STAMP GRID ────────────────────────────────────────────────────

function StampImage({ src, size, opacity = 1, grayscale = false, borderRadius = "50%" }) {
  return (
    <img
      src={src}
      alt=""
      style={{
        width: size * 0.7,
        height: size * 0.7,
        objectFit: "contain",
        opacity,
        filter: grayscale ? "grayscale(1)" : "none",
        borderRadius: 2,
        pointerEvents: "none",
      }}
    />
  );
}

function StampGrid({ config }) {
  const {
    stampTotal, stampCompleted, stampShape, stampStyle, stampSize,
    stampColumns, stampGap, accentColor, textColor,
    // Content mode
    stampContentMode,
    // Emoji mode
    stampIcon,
    // Image mode
    stampImageUrl, unstampedImageUrl, rewardImageUrl,
    // Per-state customization
    stampedBgColor, stampedBorderColor, stampedOpacity,
    unstampedBgColor, unstampedBorderColor, unstampedOpacity,
    unstampedContent,
    rewardBgColor, rewardBorderColor, rewardBorderStyle, rewardContent,
    // Stamp border width
    stampBorderWidth,
  } = config;

  const cols = stampColumns || Math.min(stampTotal, 5);
  const isImageMode = stampContentMode === "image";
  const emojiIcon = STAMP_EMOJI_PRESETS.find(s => s.id === stampIcon)?.emoji || "⭐";
  const bw = stampBorderWidth || 2;

  const getStampBorderRadius = () => {
    if (stampShape === "circle") return "50%";
    if (stampShape === "rounded") return "25%";
    if (stampShape === "square") return "4px";
    if (stampShape === "diamond") return "4px";
    if (stampShape === "hexagon") return "50%";
    return "50%";
  };

  const isDiamond = stampShape === "diamond";

  // ─── Stamped (completed) state ───
  const getStampedStyle = () => {
    const bg = stampedBgColor || hexToRgba(accentColor, 0.2);
    const border = stampedBorderColor || accentColor;
    const base = { background: bg, border: `${bw}px solid ${border}`, opacity: stampedOpacity ?? 1 };
    switch (stampStyle) {
      case "filled": return base;
      case "outlined": return { ...base, background: "transparent", border: `${bw + 0.5}px solid ${border}` };
      case "ghost": return { ...base, background: hexToRgba(border, 0.06), border: `1px solid ${hexToRgba(border, 0.25)}` };
      case "glow": return { ...base, boxShadow: `0 0 14px ${hexToRgba(border, 0.45)}` };
      default: return base;
    }
  };

  // ─── Stamped content ───
  const renderStampedContent = () => {
    if (isImageMode && stampImageUrl) {
      return <StampImage src={stampImageUrl} size={stampSize} />;
    }
    return <span style={{ fontSize: stampSize * 0.48 }}>{emojiIcon}</span>;
  };

  // ─── Unstamped (empty) state ───
  const getUnstampedStyle = () => ({
    border: `${Math.max(1, bw - 0.5)}px solid ${unstampedBorderColor || hexToRgba(textColor, 0.12)}`,
    background: unstampedBgColor || hexToRgba(textColor, 0.03),
    opacity: unstampedOpacity ?? 0.55,
  });

  const renderUnstampedContent = (idx) => {
    const mode = unstampedContent || "number";
    if (isImageMode && unstampedImageUrl) {
      return <StampImage src={unstampedImageUrl} size={stampSize} opacity={0.4} grayscale />;
    }
    switch (mode) {
      case "number": return <span style={{ color: textColor, opacity: 0.4, fontSize: stampSize * 0.34, fontWeight: 700 }}>{idx + 1}</span>;
      case "dot": return <span style={{ width: 5, height: 5, borderRadius: "50%", background: hexToRgba(textColor, 0.25), display: "block" }} />;
      case "dash": return <span style={{ width: stampSize * 0.35, height: 2, borderRadius: 1, background: hexToRgba(textColor, 0.2), display: "block" }} />;
      case "empty": return null;
      case "dimmed": return <span style={{ opacity: 0.18, fontSize: stampSize * 0.45 }}>{emojiIcon}</span>;
      case "outline": return <span style={{ opacity: 0.22, fontSize: stampSize * 0.45, filter: "grayscale(1) brightness(1.5)" }}>{emojiIcon}</span>;
      default: return <span style={{ color: textColor, opacity: 0.4, fontSize: stampSize * 0.34, fontWeight: 700 }}>{idx + 1}</span>;
    }
  };

  // ─── Reward (final) state ───
  const getRewardStyle = (isCompleted) => {
    const bg = rewardBgColor || (isCompleted ? hexToRgba(accentColor, 0.25) : "transparent");
    const border = rewardBorderColor || accentColor;
    const borderSt = rewardBorderStyle || (isCompleted ? "solid" : "dashed");
    return {
      background: bg,
      border: `${bw}px ${borderSt} ${border}`,
      opacity: isCompleted ? (stampedOpacity ?? 1) : 0.7,
      ...(isCompleted && stampStyle === "glow" ? { boxShadow: `0 0 16px ${hexToRgba(border, 0.5)}` } : {}),
    };
  };

  const renderRewardContent = (isCompleted) => {
    const mode = rewardContent || "gift";
    if (isImageMode && rewardImageUrl) {
      return <StampImage src={rewardImageUrl} size={stampSize} opacity={isCompleted ? 1 : 0.5} />;
    }
    if (isCompleted) {
      if (isImageMode && stampImageUrl) return <StampImage src={stampImageUrl} size={stampSize} />;
      if (mode === "icon") return <span style={{ fontSize: stampSize * 0.48 }}>{emojiIcon}</span>;
      return <span style={{ fontSize: stampSize * 0.44 }}>🎁</span>;
    }
    switch (mode) {
      case "gift": return <span style={{ fontSize: stampSize * 0.42, opacity: 0.6 }}>🎁</span>;
      case "icon": return <span style={{ fontSize: stampSize * 0.42, opacity: 0.35 }}>{emojiIcon}</span>;
      case "trophy": return <span style={{ fontSize: stampSize * 0.42, opacity: 0.6 }}>🏆</span>;
      case "crown": return <span style={{ fontSize: stampSize * 0.42, opacity: 0.6 }}>👑</span>;
      case "star": return <span style={{ fontSize: stampSize * 0.42, opacity: 0.6 }}>⭐</span>;
      case "free": return <span style={{ color: accentColor, fontSize: stampSize * 0.24, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" }}>FREE</span>;
      case "custom": return <span style={{ color: accentColor, fontSize: stampSize * 0.22, fontWeight: 800, textTransform: "uppercase" }}>{config.rewardStampText || "FREE"}</span>;
      default: return <span style={{ fontSize: stampSize * 0.42, opacity: 0.6 }}>🎁</span>;
    }
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: stampGap || 6,
      justifyItems: "center",
      padding: "4px 0",
    }}>
      {Array.from({ length: stampTotal }).map((_, i) => {
        const done = i < stampCompleted;
        const isReward = i === stampTotal - 1;

        let stateStyle, content;
        if (isReward) {
          stateStyle = getRewardStyle(done);
          content = renderRewardContent(done);
        } else if (done) {
          stateStyle = getStampedStyle();
          content = renderStampedContent();
        } else {
          stateStyle = getUnstampedStyle();
          content = renderUnstampedContent(i);
        }

        return (
          <div key={i} style={{
            width: stampSize,
            height: stampSize,
            borderRadius: getStampBorderRadius(),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            transform: isDiamond ? "rotate(45deg)" : "none",
            transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
            ...stateStyle,
          }}>
            <div style={{ transform: isDiamond ? "rotate(-45deg)" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── POINTS DISPLAY ────────────────────────────────────────────────

function PointsDisplay({ config }) {
  const { currentPoints, maxPoints, accentColor, textColor, pointsBarHeight, pointsBarRadius } = config;
  const pct = Math.min((currentPoints / maxPoints) * 100, 100);
  return (
    <div style={{ padding: "6px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: textColor, opacity: 0.6 }}>
        <span>{currentPoints.toLocaleString()} pts</span>
        <span>{maxPoints.toLocaleString()} pts</span>
      </div>
      <div style={{
        height: pointsBarHeight || 10,
        borderRadius: pointsBarRadius || 99,
        background: hexToRgba(textColor, 0.1),
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          borderRadius: pointsBarRadius || 99,
          background: `linear-gradient(90deg, ${accentColor}, ${hexToRgba(accentColor, 0.7)})`,
          transition: "width 0.5s ease",
        }} />
      </div>
      <div style={{ textAlign: "center", marginTop: 8, fontSize: 10, opacity: 0.5, color: textColor }}>
        {Math.round(maxPoints - currentPoints).toLocaleString()} pts until next reward
      </div>
    </div>
  );
}

// ─── TIER DISPLAY ──────────────────────────────────────────────────

function TierDisplay({ config }) {
  const tiers = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
  const idx = tiers.indexOf(config.tierName);
  const icons = ["🥉", "🥈", "🥇", "💎", "👑"];
  return (
    <div style={{ textAlign: "center", padding: "6px 0" }}>
      <div style={{ fontSize: 32, marginBottom: 4 }}>{icons[idx] || "⭐"}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: config.accentColor, letterSpacing: 2, textTransform: "uppercase" }}>
        {config.tierName}
      </div>
      {config.tierSubtext && (
        <div style={{ fontSize: 10, color: config.textColor, opacity: 0.5, marginTop: 4 }}>{config.tierSubtext}</div>
      )}
      {config.showTierProgress && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 4, borderRadius: 99, background: hexToRgba(config.textColor, 0.1), overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${config.tierProgress || 65}%`, borderRadius: 99, background: config.accentColor }} />
          </div>
          <div style={{ fontSize: 9, opacity: 0.4, color: config.textColor, marginTop: 3 }}>
            {config.tierProgress || 65}% to {tiers[Math.min(idx + 1, 4)]}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COUPON DISPLAY ────────────────────────────────────────────────

function CouponDisplay({ config }) {
  return (
    <div style={{ textAlign: "center", padding: "6px 0" }}>
      <div style={{ fontSize: 32, fontWeight: 900, color: config.accentColor, lineHeight: 1.1 }}>
        {config.couponValue || "20% OFF"}
      </div>
      {config.couponDescription && (
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4, color: config.textColor }}>{config.couponDescription}</div>
      )}
      {config.couponExpiry && (
        <div style={{
          display: "inline-block", marginTop: 8, padding: "3px 10px", borderRadius: 99,
          background: hexToRgba(config.accentColor, 0.15), fontSize: 10, color: config.accentColor, fontWeight: 600,
        }}>
          Expires: {config.couponExpiry}
        </div>
      )}
    </div>
  );
}

// ─── CODE RENDERER ─────────────────────────────────────────────────

function CodeRenderer({ config }) {
  const { codeType, codeData, codeSize, codeFg, codeBg, codeRadius, codeShowLogo, logoEmoji, codePadding } = config;
  if (codeType === "none") return null;

  const wrapStyle = {
    padding: codePadding || 8,
    background: codeBg || "#ffffff",
    borderRadius: codeRadius || 8,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={wrapStyle}>
        {codeType === "qr" && (
          <QRCodeSVG data={codeData || "https://brand.com"} size={codeSize || 100}
            fg={codeFg || "#000000"} bg={codeBg || "#ffffff"} radius={codeRadius || 4}
            showLogo={codeShowLogo} logoEmoji={logoEmoji || "◉"} />
        )}
        {codeType === "aztec" && (
          <AztecSVG data={codeData || "test"} size={codeSize || 100}
            fg={codeFg || "#000000"} bg={codeBg || "#ffffff"} radius={codeRadius || 4} />
        )}
        {(codeType === "barcode128" || codeType === "pdf417" || codeType === "ean13") && (
          <BarcodeSVG data={codeData || "1234567890128"} width={codeSize ? codeSize * 1.8 : 180}
            height={codeType === "pdf417" ? 70 : 50}
            fg={codeFg || "#000000"} bg={codeBg || "#ffffff"} type={codeType} radius={codeRadius || 3} />
        )}
      </div>
      {config.codeLabel && (
        <div style={{ fontSize: 9, opacity: 0.45, color: config.textColor }}>{config.codeLabel}</div>
      )}
    </div>
  );
}

// ─── CARD PREVIEW ──────────────────────────────────────────────────

function CardPreview({ config, format }) {
  const { w: cardW, h: cardH } = CARD_FORMATS[format];
  const scale = Math.min(1, 370 / cardW);
  const w = cardW * scale;
  const h = cardH * scale;

  const bg = config.bgType === "image" && config.bgImageUrl
    ? `url(${config.bgImageUrl}) center/cover`
    : config.bgType === "gradient" ? config.themeBg : config.themeBg;

  return (
    <div style={{
      width: w, height: h,
      borderRadius: `${config.borderRadiusTL || 16}px ${config.borderRadiusTR || 16}px ${config.borderRadiusBR || 16}px ${config.borderRadiusBL || 16}px`,
      overflow: "hidden",
      position: "relative",
      fontFamily: `'${config.headerFont}', sans-serif`,
      color: config.textColor,
      boxShadow: "0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Background layers */}
      <div style={{ position: "absolute", inset: 0, background: bg, zIndex: 0 }} />

      {/* Image overlay for readability */}
      {config.bgType === "image" && config.bgImageUrl && (
        <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${config.bgOverlayOpacity || 0.4})`, zIndex: 1 }} />
      )}

      {/* Pattern overlay */}
      {config.patternType !== "none" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
          ...getPatternCSS(config.patternType, config.textColor, config.patternOpacity || 0.06),
        }} />
      )}

      {/* Strip image */}
      {config.showStripImage && config.stripImageUrl && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: config.stripHeight || 100,
          background: `url(${config.stripImageUrl}) center/cover`,
          zIndex: 2, opacity: config.stripOpacity || 0.8,
        }} />
      )}

      {/* Cutout */}
      <CutoutOverlay style={config.cutoutStyle || "none"} position={config.cutoutPosition || 0.65}
        width={w} height={h} color={config.textColor} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 3, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Strip bar */}
        {config.showStrip && (
          <div style={{ height: config.stripBarHeight || 6, background: config.accentColor, flexShrink: 0 }} />
        )}

        {/* Header */}
        <div style={{
          padding: `${config.headerPaddingY || 14}px ${config.headerPaddingX || 16}px ${Math.max(4, (config.headerPaddingY || 14) - 8)}px`,
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          {config.showLogo && (
            <div style={{
              width: config.logoSize || 38, height: config.logoSize || 38,
              borderRadius: config.logoShape === "circle" ? "50%" : config.logoShape === "rounded" ? "22%" : "4px",
              background: config.logoBgColor || config.accentColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: (config.logoSize || 38) * 0.5, fontWeight: 900, color: config.logoTextColor || config.textColor,
              flexShrink: 0, border: config.logoBorder ? `2px solid ${hexToRgba(config.textColor, 0.2)}` : "none",
            }}>
              {config.logoEmoji || config.brandName?.charAt(0)?.toUpperCase() || "B"}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: `'${config.headerFont}', sans-serif`,
              fontSize: config.brandFontSize || 20,
              fontWeight: config.brandFontWeight || 800,
              letterSpacing: config.brandLetterSpacing || 0,
              textTransform: config.brandUppercase ? "uppercase" : "none",
              lineHeight: 1.15,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              textShadow: config.textShadow ? `0 1px 4px rgba(0,0,0,${config.textShadowOpacity || 0.3})` : "none",
            }}>
              {config.brandName || "Brand Name"}
            </div>
            {config.subtitle && (
              <div style={{
                fontFamily: `'${config.bodyFont || config.headerFont}', sans-serif`,
                fontSize: config.subtitleSize || 11, opacity: 0.6, marginTop: 1,
                letterSpacing: config.subtitleLetterSpacing || 0,
              }}>
                {config.subtitle}
              </div>
            )}
          </div>
          {config.showMemberName && (
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 9, opacity: 0.4, textTransform: "uppercase", letterSpacing: 1, fontFamily: `'${config.bodyFont || config.headerFont}', sans-serif` }}>
                {config.memberLabel || "Member"}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, fontFamily: `'${config.bodyFont || config.headerFont}', sans-serif` }}>
                {config.memberName || "Jane Doe"}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{
          flex: 1, padding: `4px ${config.bodyPaddingX || 16}px`,
          display: "flex", flexDirection: "column", justifyContent: config.bodyAlign || "center",
          gap: 4, overflow: "hidden",
        }}>
          {config.cardType === "stamp" && <StampGrid config={config} />}
          {config.cardType === "points" && <PointsDisplay config={config} />}
          {config.cardType === "tier" && <TierDisplay config={config} />}
          {config.cardType === "coupon" && <CouponDisplay config={config} />}

          {/* Reward text */}
          {config.rewardText && (
            <div style={{
              textAlign: config.rewardAlign || "center",
              fontSize: config.rewardFontSize || 11,
              opacity: 0.6,
              fontFamily: `'${config.bodyFont || config.headerFont}', sans-serif`,
              marginTop: 4,
            }}>
              {config.rewardText}
            </div>
          )}

          {/* Custom fields */}
          {config.customFields?.length > 0 && (
            <div style={{
              display: "flex", gap: 12,
              justifyContent: config.fieldsAlign || "center",
              flexWrap: "wrap", marginTop: 6,
            }}>
              {config.customFields.map((f, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, opacity: 0.4, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: `'${config.bodyFont || config.headerFont}', sans-serif` }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: config.accentColor, fontFamily: `'${config.bodyFont || config.headerFont}', sans-serif` }}>
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Code */}
        {config.codeType !== "none" && (
          <div style={{ padding: `6px ${config.bodyPaddingX || 16}px 12px`, flexShrink: 0 }}>
            <CodeRenderer config={config} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DEVICE FRAME ──────────────────────────────────────────────────

function DeviceFrame({ device, children }) {
  if (device === "none") return <div style={{ padding: 20 }}>{children}</div>;
  const isPhone = device === "iphone" || device === "pixel";
  return (
    <div style={{
      position: "relative",
      padding: isPhone ? "48px 16px 32px" : "32px 16px 24px",
      borderRadius: isPhone ? 40 : 24,
      background: "linear-gradient(145deg, rgba(255,255,255,0.035), rgba(255,255,255,0.008))",
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "0 32px 80px rgba(0,0,0,0.2)",
    }}>
      {isPhone && (
        <div style={{
          position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
          width: device === "iphone" ? 90 : 24, height: device === "iphone" ? 28 : 24,
          borderRadius: device === "iphone" ? "0 0 18px 18px" : "50%",
          background: "rgba(0,0,0,0.6)",
          ...(device === "iphone" ? {} : { border: "2px solid rgba(255,255,255,0.05)" }),
        }} />
      )}
      {children}
    </div>
  );
}

// ─── WALLET STACK PREVIEW ──────────────────────────────────────────

function WalletStackPreview({ config, format }) {
  return (
    <div style={{ position: "relative", height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {[-2, -1, 0].map((offset) => (
        <div key={offset} style={{
          position: "absolute",
          transform: `translateY(${offset * 22}px) scale(${1 + offset * 0.03})`,
          opacity: offset === 0 ? 1 : 0.3 + (offset + 2) * 0.2,
          zIndex: offset + 3,
          filter: offset < 0 ? `blur(${Math.abs(offset)}px)` : "none",
          transition: "all 0.3s ease",
        }}>
          <div style={{ transform: "scale(0.6)", transformOrigin: "center center" }}>
            <CardPreview config={config} format={format} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── UI COMPONENTS ─────────────────────────────────────────────────

const iS = {
  width: "100%", padding: "7px 10px", borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
  color: "#e4e4e7", fontSize: 12.5, fontFamily: "'Manrope', sans-serif",
  outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
};

function TI({ label, value, onChange, placeholder, mono }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 10.5, color: "#8b8b95", fontWeight: 600 }}>{label}</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={{ ...iS, ...(mono ? { fontFamily: "monospace" } : {}) }} />
    </label>
  );
}

function NI({ label, value, onChange, min, max, step = 1, unit = "" }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 10.5, color: "#8b8b95", fontWeight: 600 }}>{label}{unit && ` (${unit})`}</span>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
        min={min} max={max} step={step} style={{ ...iS, width: 80 }} />
    </label>
  );
}

function CI({ label, value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
      <div style={{ position: "relative", width: 26, height: 26, borderRadius: 6, overflow: "hidden", border: "2px solid rgba(255,255,255,0.12)", flexShrink: 0 }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ position: "absolute", inset: -6, width: 40, height: 40, border: "none", cursor: "pointer" }} />
      </div>
      <span style={{ fontSize: 10.5, color: "#8b8b95", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 9, color: "#52525b", fontFamily: "monospace" }}>{value}</span>
    </label>
  );
}

function SI({ label, value, onChange, options }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 10.5, color: "#8b8b95", fontWeight: 600 }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...iS, cursor: "pointer" }}>
        {options.map(o => <option key={o.value} value={o.value} style={{ background: "#1e1e22" }}>{o.label}</option>)}
      </select>
    </label>
  );
}

function TG({ label, value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => onChange(!value)}>
      <div style={{
        width: 34, height: 18, borderRadius: 99, flexShrink: 0, cursor: "pointer",
        background: value ? "#7c3aed" : "rgba(255,255,255,0.1)", transition: "0.15s", position: "relative",
      }}>
        <div style={{
          position: "absolute", top: 2, left: value ? 18 : 2,
          width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "0.15s",
        }} />
      </div>
      <span style={{ fontSize: 11.5, color: "#a1a1aa" }}>{label}</span>
    </label>
  );
}

function SL({ label, value, onChange, min, max, step = 1 }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10.5, color: "#8b8b95", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 10, color: "#52525b", fontFamily: "monospace" }}>{value}</span>
      </div>
      <input type="range" value={value} onChange={e => onChange(Number(e.target.value))}
        min={min} max={max} step={step} style={{ width: "100%", accentColor: "#7c3aed", height: 4 }} />
    </label>
  );
}

function Sec({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 6,
        padding: "11px 0", background: "none", border: "none", cursor: "pointer",
        color: "#d4d4d8", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.8,
        textTransform: "uppercase", fontFamily: "'Manrope', sans-serif",
      }}>
        {icon && <span style={{ fontSize: 13, opacity: 0.6 }}>{icon}</span>}
        <span style={{ flex: 1, textAlign: "left" }}>{title}</span>
        <span style={{ fontSize: 14, transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "0.15s", opacity: 0.4 }}>▾</span>
      </button>
      {open && <div style={{ paddingBottom: 12, display: "flex", flexDirection: "column", gap: 9 }}>{children}</div>}
    </div>
  );
}

function ChipSelect({ options, value, onChange, multi = false }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {options.map(o => {
        const selected = multi ? value?.includes(o.id) : value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            padding: "5px 10px", borderRadius: 6, cursor: "pointer",
            border: selected ? "1.5px solid #7c3aed" : "1px solid rgba(255,255,255,0.06)",
            background: selected ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.02)",
            color: selected ? "#c4b5fd" : "#71717a", fontSize: 11, fontWeight: 600,
            fontFamily: "'Manrope', sans-serif", transition: "0.1s",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            {o.emoji && <span>{o.emoji}</span>}
            {o.icon && <span style={{ fontSize: 14 }}>{o.icon}</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ContrastBadge({ c1, c2 }) {
  const ratio = contrastRatio(c1, c2);
  const pass = ratio >= 4.5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: pass ? "#4ade80" : "#f87171" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: pass ? "#4ade80" : "#f87171" }} />
      {ratio}:1 {pass ? "AA ✓" : "Low contrast"}
    </div>
  );
}

// ─── MAIN EDITOR ───────────────────────────────────────────────────

const DEFAULT = {
  cardType: "stamp",
  brandName: "LONA",
  subtitle: "Burger & Grill",
  memberName: "Robert Oromi",
  memberLabel: "Member",
  showMemberName: true,
  showLogo: true,
  logoEmoji: "🍔",
  logoShape: "circle",
  logoSize: 38,
  logoBgColor: "#ef4444",
  logoTextColor: "#ffffff",
  logoBorder: false,
  // Typography
  headerFont: "Bebas Neue",
  bodyFont: "DM Sans",
  textColor: "#ffffff",
  accentColor: "#ef4444",
  brandFontSize: 22,
  brandFontWeight: 800,
  brandLetterSpacing: 2,
  brandUppercase: true,
  subtitleSize: 11,
  subtitleLetterSpacing: 0,
  textShadow: false,
  textShadowOpacity: 0.3,
  // Background
  bgType: "gradient",
  themeBg: PRESET_THEMES[4].bg,
  bgImageUrl: "",
  bgOverlayOpacity: 0.45,
  // Pattern
  patternType: "dots",
  patternOpacity: 0.06,
  // Strip
  showStrip: false,
  stripBarHeight: 6,
  showStripImage: false,
  stripImageUrl: "",
  stripHeight: 100,
  stripOpacity: 0.8,
  // Border radius
  borderRadiusTL: 16,
  borderRadiusTR: 16,
  borderRadiusBR: 16,
  borderRadiusBL: 16,
  borderRadiusLinked: true,
  // Cutout
  cutoutStyle: "none",
  cutoutPosition: 0.65,
  // Layout
  headerPaddingY: 14,
  headerPaddingX: 16,
  bodyPaddingX: 16,
  bodyAlign: "center",
  fieldsAlign: "center",
  rewardAlign: "center",
  rewardFontSize: 11,
  // Stamp
  stampTotal: 10,
  stampCompleted: 6,
  stampContentMode: "emoji",
  stampIcon: "burger",
  stampImageUrl: "",
  unstampedImageUrl: "",
  rewardImageUrl: "",
  stampShape: "circle",
  stampStyle: "filled",
  stampSize: 36,
  stampColumns: 5,
  stampGap: 6,
  stampBorderWidth: 2,
  // Stamped state
  stampedBgColor: "",
  stampedBorderColor: "",
  stampedOpacity: 1,
  // Unstamped state
  unstampedBgColor: "",
  unstampedBorderColor: "",
  unstampedOpacity: 0.55,
  unstampedContent: "number",
  // Reward (final) state
  rewardBgColor: "",
  rewardBorderColor: "",
  rewardBorderStyle: "dashed",
  rewardContent: "gift",
  rewardStampText: "FREE",
  rewardText: "Collect 10 stamps → Free Burger!",
  // Points
  currentPoints: 5617,
  maxPoints: 10000,
  pointsBarHeight: 10,
  pointsBarRadius: 99,
  // Tier
  tierName: "Gold",
  tierSubtext: "Member since 2024",
  showTierProgress: true,
  tierProgress: 65,
  // Coupon
  couponValue: "20% OFF",
  couponDescription: "On your next purchase",
  couponExpiry: "2026-12-31",
  // Code
  codeType: "qr",
  codeData: "https://brand.com/card/001",
  codeSize: 96,
  codeFg: "#000000",
  codeBg: "#ffffff",
  codeRadius: 6,
  codePadding: 8,
  codeShowLogo: false,
  codeLabel: "Scan at checkout",
  // Custom fields
  customFields: [{ label: "Coupons", value: "4" }, { label: "Status", value: "VIP" }],
  // Back fields
  backFields: [
    { label: "Terms & Conditions", value: "Valid at participating locations. Cannot be combined with other offers." },
    { label: "Customer Support", value: "support@brand.com" },
  ],
  // Location
  locations: [],
  expirationDate: "",
};

export default function WalletStudioPro() {
  const [config, setConfig] = useState(DEFAULT);
  const [format, setFormat] = useState("apple");
  const [tab, setTab] = useState("design");
  const [subTab, setSubTab] = useState(null);
  const [device, setDevice] = useState("minimal");
  const [previewMode, setPreviewMode] = useState("single");
  const [showBack, setShowBack] = useState(false);
  const [history, setHistory] = useState([DEFAULT]);
  const [histIdx, setHistIdx] = useState(0);
  const [exportMsg, setExportMsg] = useState("");
  const [showAssets, setShowAssets] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = `https://fonts.googleapis.com/css2?family=${FONT_OPTIONS.map(f => f.replace(/ /g, "+") + ":wght@300;400;500;600;700;800;900").join("&family=")}&display=swap`;
    link.rel = "stylesheet";
    document.head.appendChild(link);
    const link2 = document.createElement("link");
    link2.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
    link2.rel = "stylesheet";
    document.head.appendChild(link2);
  }, []);

  const pushHistory = useCallback((newConfig) => {
    setHistory(h => [...h.slice(0, histIdx + 1), newConfig].slice(-50));
    setHistIdx(i => i + 1);
  }, [histIdx]);

  const u = useCallback((key, val) => {
    setConfig(c => {
      const next = { ...c, [key]: val };
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const undo = () => { if (histIdx > 0) { setHistIdx(histIdx - 1); setConfig(history[histIdx - 1]); } };
  const redo = () => { if (histIdx < history.length - 1) { setHistIdx(histIdx + 1); setConfig(history[histIdx + 1]); } };

  const updateField = useCallback((idx, key, val) => {
    setConfig(c => {
      const fields = [...c.customFields];
      fields[idx] = { ...fields[idx], [key]: val };
      const next = { ...c, customFields: fields };
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const updateBackField = useCallback((idx, key, val) => {
    setConfig(c => {
      const fields = [...c.backFields];
      fields[idx] = { ...fields[idx], [key]: val };
      return { ...c, backFields: fields };
    });
  }, []);

  const handleExport = (type) => {
    const data = type === "full" ? {
      format, config, platform: {
        apple: { passTypeIdentifier: "pass.com.brand.loyalty", teamIdentifier: "XXXXXXXXXX", formatVersion: 1 },
        google: { issuerId: "ISSUER_ID", classId: "LOYALTY_CLASS" },
      },
      assets: APPLE_ASSETS.map(a => ({ ...a, status: "pending" })),
    } : config;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wallet-card-${config.brandName?.toLowerCase().replace(/\s+/g, "-") || "card"}-${type}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg(`✓ ${type === "full" ? "Full config" : "Card config"} exported!`);
    setTimeout(() => setExportMsg(""), 2500);
  };

  const handleRadiusChange = (corner, val) => {
    if (config.borderRadiusLinked) {
      u("borderRadiusTL", val); u("borderRadiusTR", val);
      u("borderRadiusBR", val); u("borderRadiusBL", val);
    } else {
      u(corner, val);
    }
  };

  const tabs = [
    { id: "design", label: "Design", icon: "◆" },
    { id: "content", label: "Content", icon: "◇" },
    { id: "code", label: "Code", icon: "⊞" },
    { id: "advanced", label: "Pro", icon: "⚙" },
  ];

  // Back of card view
  const BackOfCard = () => {
    const { w, h } = CARD_FORMATS[format];
    const scale = Math.min(1, 370 / w);
    return (
      <div style={{
        width: w * scale, height: h * scale,
        borderRadius: `${config.borderRadiusTL}px ${config.borderRadiusTR}px ${config.borderRadiusBR}px ${config.borderRadiusBL}px`,
        background: "#f5f5f5", color: "#27272a", fontFamily: `'${config.bodyFont || "DM Sans"}', sans-serif`,
        padding: 20, overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        display: "flex", flexDirection: "column", gap: 14, fontSize: 11, lineHeight: 1.5,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>{config.brandName}</div>
        {config.backFields.map((f, i) => (
          <div key={i}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#71717a", letterSpacing: 0.5 }}>{f.label}</div>
            <div style={{ marginTop: 2 }}>{f.value}</div>
          </div>
        ))}
        {config.expirationDate && (
          <div style={{ marginTop: "auto", fontSize: 10, color: "#a1a1aa" }}>Expires: {config.expirationDate}</div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0c0c0e", color: "#d4d4d8", fontFamily: "'Manrope', sans-serif", overflow: "hidden" }}>

      {/* ═══ LEFT PANEL ═══ */}
      <div ref={panelRef} style={{
        width: 350, height: "100vh", background: "#111113", overflowY: "auto",
        borderRight: "1px solid rgba(255,255,255,0.04)", flexShrink: 0,
        scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent",
      }}>
        <div style={{ padding: "0 16px 50px" }}>

          {/* Header */}
          <div style={{ padding: "18px 0 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #7c3aed, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#fff" }}>W</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.5 }}>Wallet Studio <span style={{ fontSize: 10, color: "#7c3aed", fontWeight: 700 }}>PRO</span></div>
                <div style={{ fontSize: 9.5, color: "#52525b" }}>Apple PassKit & Google Wallet</div>
              </div>
            </div>
            {/* Undo/Redo */}
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              <button onClick={undo} disabled={histIdx <= 0} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: histIdx > 0 ? "#a1a1aa" : "#3f3f46", fontSize: 11, cursor: histIdx > 0 ? "pointer" : "default", fontFamily: "'Manrope', sans-serif" }}>↶ Undo</button>
              <button onClick={redo} disabled={histIdx >= history.length - 1} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: histIdx < history.length - 1 ? "#a1a1aa" : "#3f3f46", fontSize: 11, cursor: histIdx < history.length - 1 ? "pointer" : "default", fontFamily: "'Manrope', sans-serif" }}>↷ Redo</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, marginBottom: 10, background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 2 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: "6px 0", borderRadius: 6, border: "none", cursor: "pointer",
                background: tab === t.id ? "rgba(124,58,237,0.15)" : "transparent",
                color: tab === t.id ? "#c4b5fd" : "#52525b",
                fontSize: 11, fontWeight: 700, fontFamily: "'Manrope', sans-serif", transition: "0.1s",
              }}>
                <span style={{ fontSize: 10, marginRight: 3 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          {/* ═══ DESIGN TAB ═══ */}
          {tab === "design" && (
            <>
              <Sec title="Card Format" icon="📐">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {Object.entries(CARD_FORMATS).map(([k, f]) => (
                    <button key={k} onClick={() => setFormat(k)} style={{
                      padding: "8px", borderRadius: 7, cursor: "pointer", textAlign: "left",
                      border: format === k ? "1.5px solid #7c3aed" : "1px solid rgba(255,255,255,0.05)",
                      background: format === k ? "rgba(124,58,237,0.08)" : "transparent",
                      color: "#d4d4d8", fontFamily: "'Manrope', sans-serif",
                    }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 13 }}>{f.icon}</span> {f.label}
                      </div>
                      <div style={{ fontSize: 9.5, color: "#52525b", marginTop: 2 }}>{f.w}×{f.h} · {f.ratio}</div>
                    </button>
                  ))}
                </div>
              </Sec>

              <Sec title="Card Type" icon="🎴">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {CARD_TYPES.map(t => (
                    <button key={t.id} onClick={() => u("cardType", t.id)} style={{
                      padding: "8px", borderRadius: 7, cursor: "pointer", textAlign: "left",
                      border: config.cardType === t.id ? "1.5px solid #7c3aed" : "1px solid rgba(255,255,255,0.05)",
                      background: config.cardType === t.id ? "rgba(124,58,237,0.08)" : "transparent",
                      color: "#d4d4d8", fontFamily: "'Manrope', sans-serif",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{t.icon} {t.label}</div>
                      <div style={{ fontSize: 9, color: "#52525b", marginTop: 2 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </Sec>

              <Sec title="Theme & Colors" icon="🎨">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
                  {PRESET_THEMES.map(theme => (
                    <button key={theme.id} onClick={() => {
                      u("themeBg", theme.bg); u("textColor", theme.text); u("accentColor", theme.accent); u("bgType", "gradient");
                    }} style={{
                      height: 40, borderRadius: 7, background: theme.bg, cursor: "pointer",
                      border: config.themeBg === theme.bg ? "2px solid #fff" : "2px solid transparent",
                      position: "relative",
                    }} title={theme.label}>
                      <span style={{ position: "absolute", bottom: 1, left: 0, right: 0, fontSize: 7.5, color: theme.text, textAlign: "center", opacity: 0.7 }}>{theme.label}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <CI label="Text" value={config.textColor} onChange={v => u("textColor", v)} />
                  <CI label="Accent" value={config.accentColor} onChange={v => u("accentColor", v)} />
                </div>
                <ContrastBadge c1={config.textColor} c2={config.accentColor.length === 7 ? config.accentColor : "#000000"} />
              </Sec>

              <Sec title="Background" icon="🖼️">
                <ChipSelect options={[
                  { id: "gradient", label: "Gradient" },
                  { id: "image", label: "Image URL" },
                ]} value={config.bgType} onChange={v => u("bgType", v)} />
                {config.bgType === "image" && (
                  <>
                    <TI label="Background Image URL" value={config.bgImageUrl} onChange={v => u("bgImageUrl", v)} placeholder="https://example.com/bg.jpg" mono />
                    <SL label="Overlay Opacity" value={config.bgOverlayOpacity} onChange={v => u("bgOverlayOpacity", v)} min={0} max={1} step={0.05} />
                  </>
                )}
                <SI label="Pattern Overlay" value={config.patternType}
                  onChange={v => u("patternType", v)}
                  options={BG_PATTERNS.map(p => ({ value: p.id, label: p.label }))} />
                {config.patternType !== "none" && (
                  <SL label="Pattern Opacity" value={config.patternOpacity} onChange={v => u("patternOpacity", v)} min={0.01} max={0.2} step={0.01} />
                )}
              </Sec>

              <Sec title="Border Radius" icon="◻️" defaultOpen={false}>
                <TG label="Link all corners" value={config.borderRadiusLinked} onChange={v => u("borderRadiusLinked", v)} />
                {config.borderRadiusLinked ? (
                  <SL label="Radius" value={config.borderRadiusTL} onChange={v => handleRadiusChange("borderRadiusTL", v)} min={0} max={32} />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <SL label="Top Left" value={config.borderRadiusTL} onChange={v => u("borderRadiusTL", v)} min={0} max={32} />
                    <SL label="Top Right" value={config.borderRadiusTR} onChange={v => u("borderRadiusTR", v)} min={0} max={32} />
                    <SL label="Bottom Left" value={config.borderRadiusBL} onChange={v => u("borderRadiusBL", v)} min={0} max={32} />
                    <SL label="Bottom Right" value={config.borderRadiusBR} onChange={v => u("borderRadiusBR", v)} min={0} max={32} />
                  </div>
                )}
              </Sec>

              <Sec title="Cutouts & Dividers" icon="✂️" defaultOpen={false}>
                <ChipSelect options={CUTOUT_STYLES.map(c => ({ id: c.id, label: c.label }))}
                  value={config.cutoutStyle} onChange={v => u("cutoutStyle", v)} />
                {config.cutoutStyle !== "none" && (
                  <SL label="Vertical Position" value={config.cutoutPosition} onChange={v => u("cutoutPosition", v)} min={0.3} max={0.85} step={0.05} />
                )}
              </Sec>

              <Sec title="Typography" icon="Aa" defaultOpen={false}>
                <SI label="Header Font" value={config.headerFont} onChange={v => u("headerFont", v)}
                  options={FONT_OPTIONS.map(f => ({ value: f, label: f }))} />
                <SI label="Body Font" value={config.bodyFont} onChange={v => u("bodyFont", v)}
                  options={FONT_OPTIONS.map(f => ({ value: f, label: f }))} />
                <SL label="Brand Size" value={config.brandFontSize} onChange={v => u("brandFontSize", v)} min={12} max={36} />
                <SI label="Brand Weight" value={String(config.brandFontWeight)} onChange={v => u("brandFontWeight", Number(v))}
                  options={[300,400,500,600,700,800,900].map(w => ({ value: String(w), label: String(w) }))} />
                <SL label="Letter Spacing" value={config.brandLetterSpacing} onChange={v => u("brandLetterSpacing", v)} min={-2} max={10} />
                <TG label="Uppercase brand" value={config.brandUppercase} onChange={v => u("brandUppercase", v)} />
                <SL label="Subtitle Size" value={config.subtitleSize} onChange={v => u("subtitleSize", v)} min={8} max={16} />
                <TG label="Text shadow" value={config.textShadow} onChange={v => u("textShadow", v)} />
                {config.textShadow && (
                  <SL label="Shadow opacity" value={config.textShadowOpacity} onChange={v => u("textShadowOpacity", v)} min={0.1} max={0.8} step={0.05} />
                )}
              </Sec>

              <Sec title="Strip & Accents" icon="▬" defaultOpen={false}>
                <TG label="Show top strip bar" value={config.showStrip} onChange={v => u("showStrip", v)} />
                {config.showStrip && <SL label="Strip Height" value={config.stripBarHeight} onChange={v => u("stripBarHeight", v)} min={2} max={16} />}
                <TG label="Strip image banner" value={config.showStripImage} onChange={v => u("showStripImage", v)} />
                {config.showStripImage && (
                  <>
                    <TI label="Strip Image URL" value={config.stripImageUrl} onChange={v => u("stripImageUrl", v)} placeholder="https://..." mono />
                    <SL label="Strip Height" value={config.stripHeight} onChange={v => u("stripHeight", v)} min={40} max={200} />
                    <SL label="Strip Opacity" value={config.stripOpacity} onChange={v => u("stripOpacity", v)} min={0.1} max={1} step={0.05} />
                  </>
                )}
              </Sec>

              <Sec title="Layout & Spacing" icon="⊞" defaultOpen={false}>
                <SL label="Header Padding Y" value={config.headerPaddingY} onChange={v => u("headerPaddingY", v)} min={4} max={30} />
                <SL label="Header Padding X" value={config.headerPaddingX} onChange={v => u("headerPaddingX", v)} min={8} max={30} />
                <SL label="Body Padding X" value={config.bodyPaddingX} onChange={v => u("bodyPaddingX", v)} min={8} max={30} />
                <SI label="Body Vertical Align" value={config.bodyAlign} onChange={v => u("bodyAlign", v)}
                  options={[{ value: "flex-start", label: "Top" }, { value: "center", label: "Center" }, { value: "flex-end", label: "Bottom" }]} />
              </Sec>
            </>
          )}

          {/* ═══ CONTENT TAB ═══ */}
          {tab === "content" && (
            <>
              <Sec title="Brand Identity" icon="🏷️">
                <TI label="Brand Name" value={config.brandName} onChange={v => u("brandName", v)} />
                <TI label="Subtitle / Tagline" value={config.subtitle} onChange={v => u("subtitle", v)} />
                <TI label="Logo Emoji / Letter" value={config.logoEmoji} onChange={v => u("logoEmoji", v)} />
                <TG label="Show logo" value={config.showLogo} onChange={v => u("showLogo", v)} />
                {config.showLogo && (
                  <>
                    <ChipSelect options={[{ id: "circle", label: "Circle" }, { id: "rounded", label: "Rounded" }, { id: "square", label: "Square" }]}
                      value={config.logoShape} onChange={v => u("logoShape", v)} />
                    <SL label="Logo Size" value={config.logoSize} onChange={v => u("logoSize", v)} min={24} max={56} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <CI label="Logo BG" value={config.logoBgColor} onChange={v => u("logoBgColor", v)} />
                      <CI label="Logo Text" value={config.logoTextColor} onChange={v => u("logoTextColor", v)} />
                    </div>
                    <TG label="Logo border" value={config.logoBorder} onChange={v => u("logoBorder", v)} />
                  </>
                )}
              </Sec>

              <Sec title="Member" icon="👤">
                <TG label="Show member name" value={config.showMemberName} onChange={v => u("showMemberName", v)} />
                {config.showMemberName && (
                  <>
                    <TI label="Member Name" value={config.memberName} onChange={v => u("memberName", v)} />
                    <TI label="Label" value={config.memberLabel} onChange={v => u("memberLabel", v)} placeholder="Member" />
                  </>
                )}
              </Sec>

              {config.cardType === "stamp" && (
                <>
                <Sec title="Stamp Grid" icon="🎯">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <NI label="Total" value={config.stampTotal} onChange={v => u("stampTotal", v)} min={3} max={24} />
                    <NI label="Completed" value={config.stampCompleted} onChange={v => u("stampCompleted", v)} min={0} max={config.stampTotal} />
                    <NI label="Columns" value={config.stampColumns} onChange={v => u("stampColumns", v)} min={2} max={8} />
                  </div>
                  <SL label="Stamp Size" value={config.stampSize} onChange={v => u("stampSize", v)} min={20} max={56} />
                  <SL label="Gap" value={config.stampGap} onChange={v => u("stampGap", v)} min={2} max={16} />
                  <SL label="Border Width" value={config.stampBorderWidth} onChange={v => u("stampBorderWidth", v)} min={0} max={5} step={0.5} />
                  <div>
                    <span style={{ fontSize: 10.5, color: "#8b8b95", fontWeight: 600, display: "block", marginBottom: 5 }}>Shape</span>
                    <ChipSelect options={STAMP_SHAPES.map(s => ({ id: s.id, label: s.label }))}
                      value={config.stampShape} onChange={v => u("stampShape", v)} />
                  </div>
                  <div>
                    <span style={{ fontSize: 10.5, color: "#8b8b95", fontWeight: 600, display: "block", marginBottom: 5 }}>Fill Style</span>
                    <ChipSelect options={STAMP_STYLES.map(s => ({ id: s.id, label: s.label }))}
                      value={config.stampStyle} onChange={v => u("stampStyle", v)} />
                  </div>
                  <TI label="Reward Text" value={config.rewardText} onChange={v => u("rewardText", v)} />
                  <SL label="Reward Font Size" value={config.rewardFontSize} onChange={v => u("rewardFontSize", v)} min={8} max={16} />
                </Sec>

                <Sec title="Stamp Content" icon="🖼️">
                  <div>
                    <span style={{ fontSize: 10.5, color: "#8b8b95", fontWeight: 600, display: "block", marginBottom: 5 }}>Content Mode</span>
                    <ChipSelect options={STAMP_CONTENT_MODES} value={config.stampContentMode}
                      onChange={v => u("stampContentMode", v)} />
                  </div>

                  {config.stampContentMode === "emoji" && (
                    <div>
                      <span style={{ fontSize: 10.5, color: "#8b8b95", fontWeight: 600, display: "block", marginBottom: 5 }}>Stamp Emoji</span>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {STAMP_EMOJI_PRESETS.map(s => (
                          <button key={s.id} onClick={() => u("stampIcon", s.id)} style={{
                            width: 32, height: 32, borderRadius: 6, fontSize: 16, cursor: "pointer",
                            border: config.stampIcon === s.id ? "2px solid #7c3aed" : "1px solid rgba(255,255,255,0.06)",
                            background: config.stampIcon === s.id ? "rgba(124,58,237,0.12)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>{s.emoji}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {config.stampContentMode === "image" && (
                    <>
                      <div style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 8, padding: "8px 10px", fontSize: 10.5, color: "#a78bfa", lineHeight: 1.5 }}>
                        Use image URLs for brand logos or custom stamp artwork. PNG with transparency works best. Images are displayed at {Math.round(config.stampSize * 0.7)}×{Math.round(config.stampSize * 0.7)}px.
                      </div>
                      <TI label="Stamped Image URL" value={config.stampImageUrl}
                        onChange={v => u("stampImageUrl", v)}
                        placeholder="https://brand.com/logo-stamp.png" mono />
                      <TI label="Unstamped Image URL (optional)" value={config.unstampedImageUrl}
                        onChange={v => u("unstampedImageUrl", v)}
                        placeholder="https://brand.com/logo-gray.png" mono />
                      <TI label="Reward Image URL (optional)" value={config.rewardImageUrl}
                        onChange={v => u("rewardImageUrl", v)}
                        placeholder="https://brand.com/reward.png" mono />
                      {/* Live preview of uploaded images */}
                      {(config.stampImageUrl || config.unstampedImageUrl || config.rewardImageUrl) && (
                        <div style={{ display: "flex", gap: 12, padding: "8px 0", justifyContent: "center", flexWrap: "wrap" }}>
                          {config.stampImageUrl && (
                            <div style={{ textAlign: "center" }}>
                              <img src={config.stampImageUrl} alt="" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)" }}
                                onError={e => { e.target.style.display = "none"; }} />
                              <div style={{ fontSize: 9, color: "#52525b", marginTop: 3 }}>Stamped</div>
                            </div>
                          )}
                          {config.unstampedImageUrl && (
                            <div style={{ textAlign: "center" }}>
                              <img src={config.unstampedImageUrl} alt="" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)", opacity: 0.4, filter: "grayscale(1)" }}
                                onError={e => { e.target.style.display = "none"; }} />
                              <div style={{ fontSize: 9, color: "#52525b", marginTop: 3 }}>Unstamped</div>
                            </div>
                          )}
                          {config.rewardImageUrl && (
                            <div style={{ textAlign: "center" }}>
                              <img src={config.rewardImageUrl} alt="" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)" }}
                                onError={e => { e.target.style.display = "none"; }} />
                              <div style={{ fontSize: 9, color: "#52525b", marginTop: 3 }}>Reward</div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </Sec>

                <Sec title="Stamped State" icon="✅" defaultOpen={false}>
                  <div style={{ fontSize: 10, color: "#52525b", marginBottom: 4 }}>Customize how collected stamps look</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <CI label="Background" value={config.stampedBgColor || config.accentColor} onChange={v => u("stampedBgColor", v)} />
                    <CI label="Border" value={config.stampedBorderColor || config.accentColor} onChange={v => u("stampedBorderColor", v)} />
                  </div>
                  <SL label="Opacity" value={config.stampedOpacity} onChange={v => u("stampedOpacity", v)} min={0.3} max={1} step={0.05} />
                </Sec>

                <Sec title="Unstamped State" icon="⭕" defaultOpen={false}>
                  <div style={{ fontSize: 10, color: "#52525b", marginBottom: 4 }}>Customize how uncollected stamps look</div>
                  {config.stampContentMode === "emoji" && (
                    <div>
                      <span style={{ fontSize: 10.5, color: "#8b8b95", fontWeight: 600, display: "block", marginBottom: 5 }}>Placeholder Content</span>
                      <ChipSelect options={PLACEHOLDER_STYLES.map(s => ({ id: s.id, label: s.label }))}
                        value={config.unstampedContent} onChange={v => u("unstampedContent", v)} />
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <CI label="Background" value={config.unstampedBgColor || "#1a1a1a"} onChange={v => u("unstampedBgColor", v)} />
                    <CI label="Border" value={config.unstampedBorderColor || "#333333"} onChange={v => u("unstampedBorderColor", v)} />
                  </div>
                  <SL label="Opacity" value={config.unstampedOpacity} onChange={v => u("unstampedOpacity", v)} min={0.15} max={1} step={0.05} />
                </Sec>

                <Sec title="Reward Stamp (Final)" icon="🎁" defaultOpen={false}>
                  <div style={{ fontSize: 10, color: "#52525b", marginBottom: 4 }}>The last stamp — the prize. Make it special.</div>
                  {config.stampContentMode === "emoji" && (
                    <div>
                      <span style={{ fontSize: 10.5, color: "#8b8b95", fontWeight: 600, display: "block", marginBottom: 5 }}>Reward Icon</span>
                      <ChipSelect options={[
                        { id: "gift", label: "🎁 Gift" },
                        { id: "trophy", label: "🏆 Trophy" },
                        { id: "crown", label: "👑 Crown" },
                        { id: "star", label: "⭐ Star" },
                        { id: "icon", label: "Same Icon" },
                        { id: "free", label: "FREE text" },
                        { id: "custom", label: "Custom text" },
                      ]} value={config.rewardContent} onChange={v => u("rewardContent", v)} />
                    </div>
                  )}
                  {config.rewardContent === "custom" && (
                    <TI label="Custom Reward Text" value={config.rewardStampText} onChange={v => u("rewardStampText", v)} placeholder="FREE" />
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <CI label="Background" value={config.rewardBgColor || "#1a1a1a"} onChange={v => u("rewardBgColor", v)} />
                    <CI label="Border" value={config.rewardBorderColor || config.accentColor} onChange={v => u("rewardBorderColor", v)} />
                  </div>
                  <SI label="Border Style" value={config.rewardBorderStyle} onChange={v => u("rewardBorderStyle", v)}
                    options={[{ value: "dashed", label: "Dashed" }, { value: "solid", label: "Solid" }, { value: "dotted", label: "Dotted" }, { value: "double", label: "Double" }]} />
                </Sec>
                </>
              )}

              {config.cardType === "points" && (
                <Sec title="Points Card" icon="⭐">
                  <NI label="Current Points" value={config.currentPoints} onChange={v => u("currentPoints", v)} min={0} max={999999} />
                  <NI label="Max Points" value={config.maxPoints} onChange={v => u("maxPoints", v)} min={100} max={999999} />
                  <SL label="Bar Height" value={config.pointsBarHeight} onChange={v => u("pointsBarHeight", v)} min={4} max={20} />
                  <SL label="Bar Radius" value={config.pointsBarRadius} onChange={v => u("pointsBarRadius", v)} min={0} max={99} />
                </Sec>
              )}

              {config.cardType === "tier" && (
                <Sec title="Tier / VIP" icon="👑">
                  <SI label="Tier" value={config.tierName} onChange={v => u("tierName", v)}
                    options={["Bronze","Silver","Gold","Platinum","Diamond"].map(t => ({ value: t, label: t }))} />
                  <TI label="Subtext" value={config.tierSubtext} onChange={v => u("tierSubtext", v)} />
                  <TG label="Show progress to next tier" value={config.showTierProgress} onChange={v => u("showTierProgress", v)} />
                  {config.showTierProgress && (
                    <SL label="Progress %" value={config.tierProgress} onChange={v => u("tierProgress", v)} min={0} max={100} />
                  )}
                </Sec>
              )}

              {config.cardType === "coupon" && (
                <Sec title="Coupon" icon="🎟️">
                  <TI label="Value" value={config.couponValue} onChange={v => u("couponValue", v)} placeholder="20% OFF" />
                  <TI label="Description" value={config.couponDescription} onChange={v => u("couponDescription", v)} />
                  <TI label="Expiry Date" value={config.couponExpiry} onChange={v => u("couponExpiry", v)} placeholder="YYYY-MM-DD" />
                </Sec>
              )}

              <Sec title="Custom Data Fields" icon="📋" defaultOpen={false}>
                {config.customFields.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 5, alignItems: "end" }}>
                    <TI label="Label" value={f.label} onChange={v => updateField(i, "label", v)} />
                    <TI label="Value" value={f.value} onChange={v => updateField(i, "value", v)} />
                    <button onClick={() => setConfig(c => ({ ...c, customFields: c.customFields.filter((_, j) => j !== i) }))}
                      style={{ padding: "5px 8px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 13, flexShrink: 0, marginBottom: 1 }}>×</button>
                  </div>
                ))}
                <button onClick={() => setConfig(c => ({ ...c, customFields: [...c.customFields, { label: "Label", value: "Value" }] }))}
                  style={{ padding: "7px", borderRadius: 6, border: "1px dashed rgba(255,255,255,0.1)", background: "transparent", color: "#71717a", cursor: "pointer", fontSize: 11, fontFamily: "'Manrope', sans-serif" }}>
                  + Add Field
                </button>
                <SI label="Fields Alignment" value={config.fieldsAlign} onChange={v => u("fieldsAlign", v)}
                  options={[{ value: "flex-start", label: "Left" }, { value: "center", label: "Center" }, { value: "flex-end", label: "Right" }, { value: "space-between", label: "Spread" }]} />
              </Sec>
            </>
          )}

          {/* ═══ CODE TAB ═══ */}
          {tab === "code" && (
            <>
              <Sec title="Scan Code Type" icon="📱">
                <ChipSelect options={CODE_TYPES.map(c => ({ id: c.id, label: c.label }))}
                  value={config.codeType} onChange={v => u("codeType", v)} />
                {config.codeType !== "none" && (
                  <>
                    <TI label="Code Data" value={config.codeData} onChange={v => u("codeData", v)} placeholder="URL or identifier" mono />
                    <TI label="Label" value={config.codeLabel} onChange={v => u("codeLabel", v)} />
                    <SL label="Code Size" value={config.codeSize} onChange={v => u("codeSize", v)} min={50} max={160} />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <CI label="Code FG" value={config.codeFg} onChange={v => u("codeFg", v)} />
                      <CI label="Code BG" value={config.codeBg} onChange={v => u("codeBg", v)} />
                    </div>
                    <SL label="Code Radius" value={config.codeRadius} onChange={v => u("codeRadius", v)} min={0} max={16} />
                    <SL label="Code Padding" value={config.codePadding} onChange={v => u("codePadding", v)} min={0} max={20} />
                    {config.codeType === "qr" && (
                      <TG label="Show logo in QR center" value={config.codeShowLogo} onChange={v => u("codeShowLogo", v)} />
                    )}
                  </>
                )}
              </Sec>

              <Sec title="Export Config" icon="📥">
                <button onClick={() => handleExport("card")} style={{
                  width: "100%", padding: "10px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff",
                  fontSize: 12, fontWeight: 700, fontFamily: "'Manrope', sans-serif",
                }}>📥 Export Card Config</button>
                <button onClick={() => handleExport("full")} style={{
                  width: "100%", padding: "10px", borderRadius: 8, border: "1px solid rgba(124,58,237,0.3)", cursor: "pointer",
                  background: "transparent", color: "#c4b5fd",
                  fontSize: 12, fontWeight: 700, fontFamily: "'Manrope', sans-serif",
                }}>📦 Export Full Platform Config</button>
                {exportMsg && <div style={{ fontSize: 11, color: "#4ade80", textAlign: "center" }}>{exportMsg}</div>}
              </Sec>
            </>
          )}

          {/* ═══ ADVANCED TAB ═══ */}
          {tab === "advanced" && (
            <>
              <Sec title="Back of Card" icon="🔄">
                <div style={{ fontSize: 10.5, color: "#52525b", marginBottom: 4 }}>Apple Wallet back fields & terms</div>
                {config.backFields.map((f, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <TI label="Label" value={f.label} onChange={v => updateBackField(i, "label", v)} />
                    <TI label="Value" value={f.value} onChange={v => updateBackField(i, "value", v)} />
                    <button onClick={() => setConfig(c => ({ ...c, backFields: c.backFields.filter((_, j) => j !== i) }))}
                      style={{ alignSelf: "flex-start", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 10, fontFamily: "'Manrope', sans-serif" }}>Remove</button>
                  </div>
                ))}
                <button onClick={() => setConfig(c => ({ ...c, backFields: [...c.backFields, { label: "New Field", value: "" }] }))}
                  style={{ padding: "6px", borderRadius: 6, border: "1px dashed rgba(255,255,255,0.08)", background: "transparent", color: "#71717a", cursor: "pointer", fontSize: 11, fontFamily: "'Manrope', sans-serif" }}>+ Add Back Field</button>
                <TI label="Expiration Date" value={config.expirationDate} onChange={v => u("expirationDate", v)} placeholder="YYYY-MM-DD" />
              </Sec>

              <Sec title="Apple Wallet Assets" icon="🍎" defaultOpen={false}>
                <div style={{ fontSize: 10.5, color: "#52525b", lineHeight: 1.6, marginBottom: 6 }}>
                  Required image assets for .pkpass generation. All images need @1x, @2x, @3x variants.
                </div>
                {APPLE_ASSETS.map(a => (
                  <div key={a.key} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
                  }}>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: "#d4d4d8" }}>
                        {a.label} {a.required && <span style={{ color: "#ef4444", fontSize: 9 }}>Required</span>}
                      </div>
                      <div style={{ fontSize: 9.5, color: "#52525b" }}>{a.size}</div>
                    </div>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: a.required ? "#52525b" : "rgba(255,255,255,0.06)",
                    }} />
                  </div>
                ))}
              </Sec>

              <Sec title="Platform Compliance" icon="✅" defaultOpen={false}>
                <div style={{ fontSize: 11, color: "#71717a", lineHeight: 1.7 }}>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: "#a1a1aa", fontWeight: 700, marginBottom: 3 }}>Apple Wallet</div>
                    Pass types: Store Card, Generic, Coupon, Event Ticket, Boarding Pass. Requires .pkpass bundle signed with Apple Developer certificate. Max barcode types: QR, PDF417, Aztec, Code128.
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: "#a1a1aa", fontWeight: 700, marginBottom: 3 }}>Google Wallet</div>
                    Pass types: Loyalty, Offer, Gift Card, Generic, Event Ticket, Transit. Uses JWT-based API. Supports dynamic updates, web push, and Smart Tap (NFC).
                  </div>
                  <div>
                    <div style={{ color: "#a1a1aa", fontWeight: 700, marginBottom: 3 }}>Both Platforms</div>
                    HTTPS callback URLs required. Push notifications for updates. Geo-fencing notifications. Custom imagery with specific size requirements.
                  </div>
                </div>
              </Sec>

              <Sec title="Locations (Geo-notifications)" icon="📍" defaultOpen={false}>
                <div style={{ fontSize: 10.5, color: "#52525b", marginBottom: 6 }}>
                  Cards can trigger lock-screen notifications when near these coordinates.
                </div>
                {config.locations.map((loc, i) => (
                  <div key={i} style={{ display: "flex", gap: 4, alignItems: "end" }}>
                    <TI label="Label" value={loc.label} onChange={v => {
                      const locs = [...config.locations]; locs[i] = { ...locs[i], label: v }; u("locations", locs);
                    }} />
                    <TI label="Lat, Lng" value={loc.coords} onChange={v => {
                      const locs = [...config.locations]; locs[i] = { ...locs[i], coords: v }; u("locations", locs);
                    }} placeholder="41.3851, 2.1734" mono />
                    <button onClick={() => u("locations", config.locations.filter((_, j) => j !== i))}
                      style={{ padding: "5px 8px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 13, flexShrink: 0, marginBottom: 1 }}>×</button>
                  </div>
                ))}
                <button onClick={() => u("locations", [...config.locations, { label: "Store", coords: "" }])}
                  style={{ padding: "6px", borderRadius: 6, border: "1px dashed rgba(255,255,255,0.08)", background: "transparent", color: "#71717a", cursor: "pointer", fontSize: 11, fontFamily: "'Manrope', sans-serif" }}>+ Add Location</button>
              </Sec>
            </>
          )}
        </div>
      </div>

      {/* ═══ CANVAS ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>

        {/* Canvas background */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)", backgroundSize: "28px 28px", pointerEvents: "none" }} />

        {/* Top toolbar */}
        <div style={{
          position: "absolute", top: 12, display: "flex", gap: 6, alignItems: "center",
          padding: "5px 8px", background: "rgba(17,17,19,0.85)", borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(12px)", zIndex: 10,
        }}>
          <span style={{ fontSize: 9.5, color: "#52525b", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginRight: 4 }}>
            {CARD_FORMATS[format].label} · {CARD_FORMATS[format].w}×{CARD_FORMATS[format].h}
          </span>
          <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.06)" }} />
          {/* Preview mode */}
          {[{ id: "single", label: "Card" }, { id: "stack", label: "Stack" }, { id: "back", label: "Back" }].map(m => (
            <button key={m.id} onClick={() => { setPreviewMode(m.id); setShowBack(m.id === "back"); }} style={{
              padding: "3px 8px", borderRadius: 5, border: "none", cursor: "pointer",
              background: previewMode === m.id ? "rgba(124,58,237,0.2)" : "transparent",
              color: previewMode === m.id ? "#c4b5fd" : "#52525b",
              fontSize: 10.5, fontWeight: 600, fontFamily: "'Manrope', sans-serif",
            }}>{m.label}</button>
          ))}
          <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.06)" }} />
          {/* Device frame */}
          {DEVICES.map(d => (
            <button key={d.id} onClick={() => setDevice(d.id)} style={{
              padding: "3px 8px", borderRadius: 5, border: "none", cursor: "pointer",
              background: device === d.id ? "rgba(124,58,237,0.2)" : "transparent",
              color: device === d.id ? "#c4b5fd" : "#52525b",
              fontSize: 10.5, fontWeight: 600, fontFamily: "'Manrope', sans-serif",
            }}>{d.label}</button>
          ))}
        </div>

        {/* Card render */}
        {previewMode === "stack" ? (
          <WalletStackPreview config={config} format={format} />
        ) : (
          <DeviceFrame device={device}>
            {showBack ? <BackOfCard /> : <CardPreview config={config} format={format} />}
          </DeviceFrame>
        )}

        {/* Bottom bar */}
        <div style={{
          position: "absolute", bottom: 14, display: "flex", gap: 16,
          fontSize: 9.5, color: "#27272a", letterSpacing: 0.3,
        }}>
          <span>Apple PassKit</span><span>·</span><span>Google Wallet API</span><span>·</span><span>PDF417 / QR / Aztec / Code128 / EAN-13</span>
        </div>
      </div>
    </div>
  );
}