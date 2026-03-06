"use client"

import { useEffect, useState } from "react"
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
import { Card } from "@/components/ui/card"

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
  const [mounted, setMounted] = useState(false)
  const maxInteractions = Math.max(...data.map((d) => d.interactions), 1)

  useEffect(() => setMounted(true), [])

  return (
    <Card className="p-5">
      <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
        Busiest Days
      </h3>
      <div className="h-50">
        {!mounted ? null : <ResponsiveContainer width="100%" height="100%">
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
            <Bar dataKey="interactions" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.interactions === maxInteractions
                      ? "oklch(0.55 0.2 265)"
                      : "oklch(0.55 0.2 265 / 0.3)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>}
      </div>
    </Card>
  )
}
