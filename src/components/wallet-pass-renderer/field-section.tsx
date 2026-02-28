"use client"

type FieldPair = {
  label: string
  value: string
}

type FieldSectionProps = {
  fields: FieldPair[]
  textColor: string
  /** Compact layout reduces font sizes */
  compact?: boolean
}

export function FieldSection({ fields, textColor, compact }: FieldSectionProps) {
  if (fields.length === 0) return null

  const labelSize = compact ? 8 : 10
  const valueSize = compact ? 11 : 14

  return (
    <div
      style={{
        display: "flex",
        gap: compact ? 12 : 16,
        flexWrap: "wrap",
      }}
    >
      {fields.map((field, i) => (
        <div key={i} style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: labelSize,
              fontWeight: 400,
              color: textColor,
              opacity: 0.6,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: compact ? 1 : 2,
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
              fontWeight: 500,
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
