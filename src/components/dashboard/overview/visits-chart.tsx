"use client"

import { useEffect, useState, useTransition } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { format, parseISO } from "date-fns"
import type { InteractionsDataPoint } from "@/server/analytics"
import { getInteractionsOverTime } from "@/server/analytics"

type Range = "7d" | "30d" | "90d" | "12m"

const RANGE_LABELS: { value: Range; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "12m", label: "12m" },
]

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { value: number; payload: InteractionsDataPoint }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const data = payload[0]
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">
        {format(parseISO(data.payload.date), "MMM d, yyyy")}
      </p>
      <p className="text-sm font-medium">
        {data.value} interaction{data.value !== 1 ? "s" : ""}
      </p>
    </div>
  )
}

type InteractionsChartProps = {
  initialData: InteractionsDataPoint[]
  initialRange: Range
}

export function InteractionsChart({ initialData, initialRange }: InteractionsChartProps) {
  const [mounted, setMounted] = useState(false)
  const [range, setRange] = useState<Range>(initialRange)
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()

  useEffect(() => setMounted(true), [])

  function handleRangeChange(newRange: Range) {
    setRange(newRange)
    startTransition(async () => {
      const newData = await getInteractionsOverTime(newRange)
      setData(newData)
    })
  }

  // Format x-axis based on range
  function formatXAxis(dateStr: string) {
    const d = parseISO(dateStr)
    if (range === "12m") return format(d, "MMM")
    if (range === "90d") return format(d, "MMM d")
    return format(d, "MMM d")
  }

  // Calculate tick interval to avoid clutter
  const tickInterval =
    range === "7d" ? 0 : range === "30d" ? 4 : range === "90d" ? 13 : 29

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-[13px] font-medium text-muted-foreground">
          Activity Over Time
        </h3>
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/50 p-0.5">
          {RANGE_LABELS.map((r) => (
            <button
              key={r.value}
              onClick={() => handleRangeChange(r.value)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                range === r.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className={`h-50 sm:h-65 transition-opacity duration-200 ${isPending ? "opacity-50" : ""}`}
      >
        {!mounted ? null : <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="interactionsFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="oklch(0.55 0.2 265)"
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor="oklch(0.55 0.2 265)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="oklch(0.915 0.005 285)"
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              interval={tickInterval}
              tick={{ fontSize: 11, fill: "oklch(0.52 0.01 285)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "oklch(0.52 0.01 285)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="interactions"
              stroke="oklch(0.55 0.2 265)"
              strokeWidth={2}
              fill="url(#interactionsFill)"
            />
          </AreaChart>
        </ResponsiveContainer>}
      </div>
    </div>
  )
}
