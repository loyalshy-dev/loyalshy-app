"use client"

import { useEffect, useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import type { RewardDistributionItem } from "@/server/analytics"
import { Card } from "@/components/ui/card"

// Generate brand-tinted shades for the donut segments
function getSegmentColor(index: number, total: number): string {
  const lightness = 0.35 + (index / total) * 0.35
  return `oklch(${lightness} 0.15 265)`
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: {
    value: number
    payload: RewardDistributionItem & { name: string }
  }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const data = payload[0]
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{data.payload.name}</p>
      <p className="text-sm font-medium">
        {data.value} customer{data.value !== 1 ? "s" : ""}
      </p>
    </div>
  )
}

type RewardDistributionChartProps = {
  data: RewardDistributionItem[]
  visitsRequired: number
  /** Name of the program shown in the chart. Used when multi-program is active. */
  programName?: string
}

export function RewardDistributionChart({
  data,
  visitsRequired,
  programName,
}: RewardDistributionChartProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const chartData = data.map((d) => ({
    ...d,
    name: `${d.position}/${visitsRequired} visits`,
  }))

  const totalCustomers = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <Card className="p-5">
      <h3 className="text-[13px] font-medium text-muted-foreground mb-4">
        Reward Cycle Progress
        {programName && (
          <span className="ml-1 text-muted-foreground/60">
            ({programName})
          </span>
        )}
      </h3>
      {totalCustomers === 0 ? (
        <div className="flex items-center justify-center h-50 text-sm text-muted-foreground">
          No customers yet
        </div>
      ) : (
        <div className="h-50 relative">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="count"
                  paddingAngle={2}
                  stroke="none"
                >
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={getSegmentColor(i, chartData.length)}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <span className="text-xl font-semibold tabular-nums">
                {totalCustomers}
              </span>
              <br />
              <span className="text-[11px] text-muted-foreground">total</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
