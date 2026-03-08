"use client"

type FieldPair = {
  label: string
  value: string
}

type FieldSectionProps = {
  fields: FieldPair[]
  textColor: string
  labelColor?: string | null
  /** Compact layout reduces font sizes */
  compact?: boolean
  /** Google uses same color for labels and values */
  format?: "apple" | "google"
}

export function FieldSection({ fields, textColor, labelColor, compact, format = "apple", small }: FieldSectionProps & { small?: boolean }) {
  if (fields.length === 0) return null

  const labelSize = compact ? 8 : small ? 9 : (format === "google" ? 10 : 10)
  const valueSize = compact ? 11 : small ? 14 : (format === "google" ? 12 : 20)

  return (
    <div
      style={{
        display: "flex",
        gap: compact ? 12 : 16,
        flexWrap: "wrap",
      }}
    >
      {fields.map((field, i) => (
        <div key={i} style={{ flex: 1, minWidth: 0, textAlign: i === fields.length - 1 && fields.length > 1 ? "right" : undefined }}>
          <div
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
