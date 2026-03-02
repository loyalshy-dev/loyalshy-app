"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import type { BusiestDayData } from "@/server/analytics"

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { value: number; payload: BusiestDayData }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const data = payload[0]
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{data.payload.day}</p>
      <p className="text-sm font-medium">
        {data.value} interaction{data.value !== 1 ? "s" : ""}
      </p>
    </div>
  )
}

type BusiestDaysChartProps = {
  data: BusiestDayData[]
}

export function BusiestDaysChart({ data }: BusiestDaysChartProps) {
  const maxVisits = Math.max(...data.map((d) => d.visits), 1)

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
        Busiest Days
      </h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <XAxis
              dataKey="day"
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
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="visits" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.visits === maxVisits
                      ? "oklch(0.55 0.2 265)"
                      : "oklch(0.55 0.2 265 / 0.3)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
