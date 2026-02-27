"use client"

import { Users, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"

type CustomerEmptyStateProps = {
  onAddCustomer: () => void
}

export function CustomerEmptyState({ onAddCustomer }: CustomerEmptyStateProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-4">
          <Users className="size-6 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold mb-1">No customers yet</h3>
        <p className="text-[13px] text-muted-foreground max-w-sm mb-6">
          Add your first customer to start tracking visits and building loyalty.
          They&apos;ll appear here once added.
        </p>
        <Button size="sm" className="gap-1.5" onClick={onAddCustomer}>
          <UserPlus className="size-3.5" />
          Add Customer
        </Button>
      </div>
    </div>
  )
}
