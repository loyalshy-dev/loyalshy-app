"use client"

type FieldPair = {
  label: string
  value: string
}

type FieldSectionProps = {
  fields: FieldPair[]
  textColor: string
  labelColor?: string | null
  /** Google uses same color for labels and values */
  format?: "apple" | "google"
  /** Smaller text for constrained layouts (e.g. ticket) */
  small?: boolean
}

/**
 * Apple Wallet–style dynamic text sizing.
 * Scales font size down based on value length to prevent overflow,
 * mimicking how real Apple Wallet passes auto-shrink text to fit.
 */
function dynamicValueSize(baseSize: number, value: string): number {
  const len = value.length
  if (len <= 8) return baseSize
  if (len <= 12) return Math.max(baseSize - 2, 11)
  if (len <= 18) return Math.max(baseSize - 4, 10)
  if (len <= 25) return Math.max(baseSize - 6, 9)
  return Math.max(baseSize - 8, 8)
}

export function FieldSection({ fields, textColor, labelColor, format = "apple", small }: FieldSectionProps) {
  if (fields.length === 0) return null

  // Apple: scale base text down as more fields are added to prevent overflow
  const n = fields.length
  const appleBaseValueSize = n <= 2 ? 22 : n === 3 ? 18 : 14
  const appleLabelSize = n <= 2 ? 11 : n === 3 ? 10 : 9
  const labelSize = small ? 9 : (format === "google" ? 10 : appleLabelSize)
  const baseValueSize = small ? 14 : (format === "google" ? 12 : appleBaseValueSize)

  // Use the MINIMUM dynamic size across all fields in the row
  // so all fields render at the same size (matches real wallet behavior)
  const valueSize = !small
    ? Math.min(...fields.map((f) => dynamicValueSize(baseValueSize, f.value)))
    : baseValueSize

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      {fields.map((field, i) => (
        <div key={i} style={{ flex: 1, minWidth: 0, textAlign: i === fields.length - 1 && fields.length > 1 ? "right" : undefined }}>
          <div
            data-color-zone="labels"
            style={{
              fontSize: labelSize,
              fontWeight: format === "google" ? 500 : 700,
              color: format === "google" ? textColor : (labelColor ?? textColor),
              opacity: format === "google" ? 1 : (labelColor ? 1 : 0.6),
              textTransform: "uppercase",
              letterSpacing: format === "google" ? "0.02em" : "0.04em",
              marginBottom: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {field.label}
          </div>
          <div
            data-color-zone="text"
            style={{
              fontSize: valueSize,
              fontWeight: format === "google" ? 500 : 300,
              color: textColor,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {field.value}
          </div>
        </div>
      ))}
    </div>
  )
}
