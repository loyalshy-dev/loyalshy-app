"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RewardStatCards } from "./reward-stat-cards"
import { RewardFilters } from "./reward-filters"
import { RewardTable } from "./reward-table"
import { RedeemRewardDialog } from "./redeem-reward-dialog"
import { RewardEmptyState } from "./reward-empty-state"
import type { RewardListResult, RewardStats, RewardRow } from "@/server/reward-actions"

type ProgramOption = {
  id: string
  name: string
}

type RewardsViewProps = {
  result: RewardListResult
  stats: RewardStats
  tab: "available" | "redeemed" | "expired"
  search: string
  sort: string
  order: "asc" | "desc"
  page: number
  dateFrom: string
  dateTo: string
  isEmpty: boolean
  programs: ProgramOption[]
  selectedProgramId: string
  hideProgramFilter?: boolean
  basePath?: string
}

export function RewardsView({
  result,
  stats,
  tab,
  search,
  sort,
  order,
  page,
  dateFrom,
  dateTo,
  isEmpty,
  programs,
  selectedProgramId,
  hideProgramFilter = false,
  basePath = "/dashboard/rewards",
}: RewardsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [redeemReward, setRedeemReward] = useState<RewardRow | null>(null)
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false)

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    params.delete("page")
    params.delete("sort")
    params.delete("order")
    router.push(`${basePath}?${params.toString()}`)
  }

  function handleProgramChange(programId: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (programId) {
      params.set("programId", programId)
    } else {
      params.delete("programId")
    }
    params.delete("page")
    router.push(`${basePath}?${params.toString()}`)
  }

  function handleRedeem(reward: RewardRow) {
    setRedeemReward(reward)
    setRedeemDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rewards</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Track and manage earned rewards.
          </p>
        </div>

        {/* Program filter */}
        {!hideProgramFilter && programs.length > 1 && (
          <select
            value={selectedProgramId}
            onChange={(e) => handleProgramChange(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-[160px]"
          >
            <option value="">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isEmpty ? (
        <RewardEmptyState />
      ) : (
        <>
          {/* Stat cards */}
          <RewardStatCards stats={stats} />

          {/* Tabs */}
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList className="h-9 bg-muted/50">
              <TabsTrigger value="available" className="text-[13px] h-7 px-3">
                Available
              </TabsTrigger>
              <TabsTrigger value="redeemed" className="text-[13px] h-7 px-3">
                Redeemed
              </TabsTrigger>
              <TabsTrigger value="expired" className="text-[13px] h-7 px-3">
                Expired
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters */}
          <RewardFilters
            search={search}
            dateFrom={dateFrom}
            dateTo={dateTo}
            totalResults={result.total}
            basePath={basePath}
          />

          {/* Table */}
          <RewardTable
            rewards={result.rewards}
            pageCount={result.pageCount}
            currentPage={page}
            total={result.total}
            sort={sort}
            order={order}
            activeTab={tab}
            onRedeem={handleRedeem}
            basePath={basePath}
          />
        </>
      )}

      {/* Redeem dialog */}
      <RedeemRewardDialog
        reward={redeemReward}
        open={redeemDialogOpen}
        onOpenChange={setRedeemDialogOpen}
        onRedeemed={() => {
          setRedeemReward(null)
        }}
      />
    </div>
  )
}
