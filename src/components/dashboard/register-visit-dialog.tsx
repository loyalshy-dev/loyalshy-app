"use client"

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from "react"
import { formatDistanceToNow } from "date-fns"
import {
  Search,
  Stamp,
  Loader2,
  ArrowLeft,
  Check,
  PartyPopper,
  CreditCard,
  ScanLine,
  Ticket,
  Crown,
  Coins,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  searchCustomersForVisit,
  registerVisit,
  redeemCoupon,
  checkInMember,
  earnPoints,
  redeemPoints,
  lookupEnrollmentByWalletPassId,
  type VisitSearchResult,
  type RedeemCouponResult,
  type CheckInResult,
  type EarnPointsResult,
  type RedeemPointsResult,
} from "@/server/visit-actions"
import type { EnrollmentSummary } from "@/types/enrollment"
import { QrScannerView } from "@/components/dashboard/qr-scanner-view"
import { parseStampGridConfig, parseStripFilters } from "@/lib/wallet/card-design"
import { parsePointsConfig, getCheapestCatalogItem } from "@/lib/program-config"
import { WalletPassRenderer, type WalletPassDesign } from "@/components/wallet-pass-renderer"

// ─── Types ──────────────────────────────────────────────────

type Step = "search" | "program" | "confirm" | "success"

type RegisterVisitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-select a customer (e.g., from customer detail sheet) */
  preselectedCustomerId?: string | null
  preselectedCustomerName?: string | null
}

// ─── Helpers ────────────────────────────────────────────────

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `oklch(0.55 0.12 ${hue})`
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

// ─── Component ──────────────────────────────────────────────

export function RegisterVisitDialog({
  open,
  onOpenChange,
  preselectedCustomerId,
  preselectedCustomerName,
}: RegisterVisitDialogProps) {
  const [step, setStep] = useState<Step>("search")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<VisitSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] =
    useState<VisitSearchResult | null>(null)
  const [selectedEnrollment, setSelectedEnrollment] =
    useState<EnrollmentSummary | null>(null)
  const [isRegistering, startRegister] = useTransition()
  const [wasRewardEarned, setWasRewardEarned] = useState(false)
  const [rewardDescription, setRewardDescription] = useState("")
  const [resultVisits, setResultVisits] = useState({
    newCycleVisits: 0,
    newTotalVisits: 0,
    visitsRequired: 10,
    programName: "",
  })
  const [couponResult, setCouponResult] = useState<RedeemCouponResult | null>(null)
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null)
  const [earnPointsResult, setEarnPointsResult] = useState<EarnPointsResult | null>(null)
  const [redeemPointsResult, setRedeemPointsResult] = useState<RedeemPointsResult | null>(null)
  const [scanMode, setScanMode] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [isScanLooking, setIsScanLooking] = useState(false)
  const [hasCamera, setHasCamera] = useState<boolean | null>(null)
  const [wasScanned, setWasScanned] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check camera availability once on mount
  useEffect(() => {
    let cancelled = false
    import("qr-scanner").then((mod) => {
      mod.default.hasCamera().then((result) => {
        if (!cancelled) setHasCamera(result)
      })
    })
    return () => { cancelled = true }
  }, [])

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      // If preselected, fetch customer data then decide on step
      if (preselectedCustomerId && preselectedCustomerName) {
        setSelectedCustomer({
          id: preselectedCustomerId,
          fullName: preselectedCustomerName,
          email: null,
          phone: null,
          totalVisits: 0,
          lastVisitAt: null,
          enrollments: [],
        })
        setSelectedEnrollment(null)
        setStep("search") // Temporary — will update after fetch
        // Fetch full customer data
        searchCustomersForVisit(preselectedCustomerName).then((resp) => {
          const match = resp.customers.find((r) => r.id === preselectedCustomerId)
          if (match) {
            setSelectedCustomer(match)
            const activeEnrollments = match.enrollments.filter(
              (e) => e.status === "ACTIVE"
            )
            if (activeEnrollments.length === 1) {
              // Auto-select the only enrollment
              setSelectedEnrollment(activeEnrollments[0])
              setStep("confirm")
            } else if (activeEnrollments.length > 1) {
              setStep("program")
            } else {
              // No active enrollments
              setStep("confirm")
            }
          } else {
            setStep("confirm")
          }
        })
      } else {
        setStep("search")
        setQuery("")
        setResults([])
        setSelectedCustomer(null)
        setSelectedEnrollment(null)
        setCouponResult(null)
        setCheckInResult(null)
        setEarnPointsResult(null)
        setRedeemPointsResult(null)
        setScanMode(false)
        setScanError(null)
        setIsScanLooking(false)
        setWasScanned(false)
        // Focus search input after animation
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }
    } else {
      // Cleanup timers and scan state on close
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
      setScanMode(false)
      setScanError(null)
      setIsScanLooking(false)
      setWasScanned(false)
    }
  }, [open, preselectedCustomerId, preselectedCustomerName])

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      const resp = await searchCustomersForVisit(value)
      setResults(resp.customers)
      setIsSearching(false)
    }, 300)
  }, [])

  // Select customer -> pick enrollment or go to confirm
  function handleSelectCustomer(customer: VisitSearchResult) {
    setSelectedCustomer(customer)
    const activeEnrollments = customer.enrollments.filter(
      (e) => e.status === "ACTIVE"
    )
    if (activeEnrollments.length === 1) {
      // Auto-select the only enrollment
      setSelectedEnrollment(activeEnrollments[0])
      setStep("confirm")
    } else if (activeEnrollments.length > 1) {
      // Multiple enrollments — show program picker
      setSelectedEnrollment(null)
      setStep("program")
    } else {
      // No active enrollments — still go to confirm (will show message)
      setSelectedEnrollment(null)
      setStep("confirm")
    }
  }

  // Select a program enrollment
  function handleSelectEnrollment(enrollment: EnrollmentSummary) {
    setSelectedEnrollment(enrollment)
    setStep("confirm")
  }

  // Helper to start auto-dismiss timer
  function autoDismiss(ms = 2500) {
    autoDismissRef.current = setTimeout(() => {
      onOpenChange(false)
    }, ms)
  }

  // Confirm visit registration
  function handleConfirm() {
    if (!selectedEnrollment) return

    startRegister(async () => {
      const result = await registerVisit(selectedEnrollment.enrollmentId)

      if (!result.success) {
        toast.error(result.error ?? "Failed to register visit")
        return
      }

      setWasRewardEarned(result.wasRewardEarned)
      setRewardDescription(result.rewardDescription ?? "")
      setResultVisits({
        newCycleVisits: result.newCycleVisits,
        newTotalVisits: result.newTotalVisits,
        visitsRequired: result.visitsRequired,
        programName: result.programName ?? selectedEnrollment.programName,
      })

      // Haptic feedback
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10)
      }

      // Toast feedback
      if (result.wasRewardEarned) {
        toast.success(
          `Visit registered — Reward earned!`,
          { description: result.rewardDescription }
        )
      } else {
        toast.success(`Visit registered for ${selectedCustomer?.fullName}`)
      }

      {
        setStep("success")
        autoDismiss()
      }
    })
  }

  // Confirm coupon redemption
  function handleConfirmCoupon() {
    if (!selectedEnrollment) return

    startRegister(async () => {
      const result = await redeemCoupon(selectedEnrollment.enrollmentId)

      if (!result.success) {
        toast.error(result.error ?? "Failed to redeem coupon")
        return
      }

      setCouponResult(result)

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10)
      }

      toast.success(
        `Coupon redeemed for ${selectedCustomer?.fullName}`,
        { description: result.discountText }
      )

      {
        setStep("success")
        autoDismiss()
      }
    })
  }

  // Confirm membership check-in
  function handleConfirmCheckIn() {
    if (!selectedEnrollment) return

    startRegister(async () => {
      const result = await checkInMember(selectedEnrollment.enrollmentId)

      if (!result.success) {
        toast.error(result.error ?? "Failed to record check-in")
        return
      }

      setCheckInResult(result)
      setStep("success")

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10)
      }

      toast.success(`Check-in recorded for ${selectedCustomer?.fullName}`)

      autoDismiss()
    })
  }

  // Earn points for a POINTS program visit
  function handleEarnPoints() {
    if (!selectedEnrollment) return

    startRegister(async () => {
      const result = await earnPoints(selectedEnrollment.enrollmentId)

      if (!result.success) {
        toast.error(result.error ?? "Failed to earn points")
        return
      }

      setEarnPointsResult(result)

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10)
      }

      toast.success(
        `+${result.pointsEarned} pts earned for ${selectedCustomer?.fullName}`,
        { description: `New balance: ${result.newBalance} pts` }
      )

      setStep("success")
      autoDismiss()
    })
  }

  // Redeem a catalog item for a POINTS program
  function handleRedeemPoints(catalogItemId: string) {
    if (!selectedEnrollment) return

    startRegister(async () => {
      const result = await redeemPoints(selectedEnrollment.enrollmentId, catalogItemId)

      if (!result.success) {
        toast.error(result.error ?? "Failed to redeem reward")
        return
      }

      setRedeemPointsResult(result)

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10)
      }

      toast.success(
        `Reward redeemed for ${selectedCustomer?.fullName}`,
        { description: result.itemName }
      )

      setStep("success")
      autoDismiss()
    })
  }

  // QR scan result handler
  async function handleScanResult(data: string) {
    setScanError(null)
    setIsScanLooking(true)

    const result = await lookupEnrollmentByWalletPassId(data)

    if (!result.success) {
      setScanError(result.error ?? "Scan failed")
      setIsScanLooking(false)
      // Error haptic
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([50, 30, 50])
      }
      return
    }

    // Success
    setSelectedCustomer(result.customer!)
    setSelectedEnrollment(result.enrollment!)
    setWasScanned(true)
    setScanMode(false)
    setIsScanLooking(false)
    setStep("confirm")
    // Success haptic
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10)
    }
  }

  // Go back
  function handleBack() {
    if (step === "program") {
      if (wasScanned) {
        // Return to scan mode
        setScanMode(true)
        setStep("search")
        setSelectedCustomer(null)
        setSelectedEnrollment(null)
      } else {
        setStep("search")
        setSelectedCustomer(null)
        setSelectedEnrollment(null)
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }
    } else if (step === "confirm") {
      if (wasScanned) {
        // Return to scan mode
        setWasScanned(false)
        setScanMode(true)
        setStep("search")
        setSelectedCustomer(null)
        setSelectedEnrollment(null)
      } else {
        const activeEnrollments = selectedCustomer?.enrollments.filter(
          (e) => e.status === "ACTIVE"
        ) ?? []
        if (activeEnrollments.length > 1) {
          // Go back to program picker
          setSelectedEnrollment(null)
          setStep("program")
        } else {
          // Go back to search
          setStep("search")
          setSelectedCustomer(null)
          setSelectedEnrollment(null)
          setTimeout(() => searchInputRef.current?.focus(), 100)
        }
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
      onOpenChange(v)
    }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden max-md:h-[85dvh] max-md:mt-auto max-md:mb-0 max-md:rounded-b-none">
        {step === "search" && scanMode && (
          <div className="flex flex-col">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle className="text-base">Scan Wallet Pass</DialogTitle>
            </DialogHeader>
            <div className="pt-3">
              <QrScannerView
                onScan={handleScanResult}
                onBack={() => {
                  setScanMode(false)
                  setScanError(null)
                  setIsScanLooking(false)
                  setTimeout(() => searchInputRef.current?.focus(), 100)
                }}
                isProcessing={isScanLooking}
                error={scanError}
                onRetry={() => {
                  setScanError(null)
                  setIsScanLooking(false)
                }}
              />
            </div>
          </div>
        )}
        {step === "search" && !scanMode && (
          <SearchStep
            query={query}
            results={results}
            isSearching={isSearching}
            searchInputRef={searchInputRef}
            onSearch={handleSearch}
            onSelect={handleSelectCustomer}
            hasCamera={hasCamera}
            onScanMode={() => {
              setScanMode(true)
              setScanError(null)
            }}
          />
        )}
        {step === "program" && selectedCustomer && (
          <ProgramPickerStep
            customer={selectedCustomer}
            onSelect={handleSelectEnrollment}
            onBack={handleBack}
          />
        )}
        {step === "confirm" && selectedCustomer && (
          <ConfirmStep
            customer={selectedCustomer}
            enrollment={selectedEnrollment}
            isRegistering={isRegistering}
            onConfirm={handleConfirm}
            onConfirmCoupon={handleConfirmCoupon}
            onConfirmCheckIn={handleConfirmCheckIn}
            onEarnPoints={handleEarnPoints}
            onRedeemPoints={handleRedeemPoints}
            onBack={handleBack}
            cardDesign={selectedEnrollment?.cardDesign ?? null}
          />
        )}
        {step === "success" && selectedCustomer && (
          <SuccessStep
            customer={selectedCustomer}
            wasRewardEarned={wasRewardEarned}
            rewardDescription={rewardDescription}
            newCycleVisits={resultVisits.newCycleVisits}
            visitsRequired={resultVisits.visitsRequired}
            programName={resultVisits.programName}
            couponResult={couponResult}
            checkInResult={checkInResult}
            earnPointsResult={earnPointsResult}
            redeemPointsResult={redeemPointsResult}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Search Step ────────────────────────────────────────────

function SearchStep({
  query,
  results,
  isSearching,
  searchInputRef,
  onSearch,
  onSelect,
  hasCamera,
  onScanMode,
}: {
  query: string
  results: VisitSearchResult[]
  isSearching: boolean
  searchInputRef: React.RefObject<HTMLInputElement | null>
  onSearch: (value: string) => void
  onSelect: (customer: VisitSearchResult) => void
  hasCamera: boolean | null
  onScanMode: () => void
}) {
  return (
    <>
      <DialogHeader className="p-4 pb-0">
        <DialogTitle className="text-base">Register Visit</DialogTitle>
      </DialogHeader>

      <div className="p-4 pb-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search by name, email, or phone..."
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-9 h-10 text-[13px]"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
            )}
          </div>
          {hasCamera && (
            <Button
              variant="outline"
              size="icon"
              className="size-10 shrink-0"
              onClick={onScanMode}
              aria-label="Scan QR code"
            >
              <ScanLine className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="max-h-[50vh] min-h-30">
        <div className="px-4 pb-4">
          {!query.trim() ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Stamp className="size-8 text-muted-foreground/40" />
              <p className="text-[13px] text-muted-foreground">
                Type a name to find a customer
              </p>
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Search className="size-8 text-muted-foreground/40" />
              <p className="text-[13px] text-muted-foreground">
                No customers found for &ldquo;{query}&rdquo;
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((customer) => {
                // Show primary enrollment progress
                const activeEnrollments = customer.enrollments.filter(
                  (e) => e.status === "ACTIVE"
                )
                const primary = activeEnrollments[0]

                return (
                  <button
                    key={customer.id}
                    type="button"
                    className="flex items-center gap-3 w-full rounded-lg px-3 py-3 min-h-12 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onSelect(customer)}
                  >
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: getAvatarColor(customer.fullName) }}
                    >
                      {getInitials(customer.fullName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">
                        {customer.fullName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {customer.email ?? customer.phone ?? "No contact info"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {primary ? (
                        <>
                          <p className="text-[13px] font-semibold tabular-nums text-brand">
                            {primary.currentCycleVisits}/{primary.visitsRequired}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-25">
                            {activeEnrollments.length > 1
                              ? `${activeEnrollments.length} programs`
                              : primary.programName}
                          </p>
                        </>
                      ) : customer.lastVisitAt ? (
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(customer.lastVisitAt), {
                            addSuffix: true,
                          })}
                        </p>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  )
}

// ─── Program Picker Step ────────────────────────────────────

function ProgramPickerStep({
  customer,
  onSelect,
  onBack,
}: {
  customer: VisitSearchResult
  onSelect: (enrollment: EnrollmentSummary) => void
  onBack: () => void
}) {
  const activeEnrollments = customer.enrollments.filter(
    (e) => e.status === "ACTIVE"
  )

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 pb-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <DialogTitle className="text-base">Select Program</DialogTitle>
      </div>

      {/* Customer info */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
          style={{ backgroundColor: getAvatarColor(customer.fullName) }}
        >
          {getInitials(customer.fullName)}
        </div>
        <div>
          <p className="text-[14px] font-semibold">{customer.fullName}</p>
          <p className="text-[12px] text-muted-foreground">
            {activeEnrollments.length} active program{activeEnrollments.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Program cards */}
      <ScrollArea className="max-h-[50vh] min-h-30">
        <div className="px-4 py-3 space-y-2">
          {activeEnrollments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No active programs</p>
            </div>
          )}
          {activeEnrollments.map((enrollment) => {
            const isCoupon = enrollment.programType === "COUPON"
            const isMembership = enrollment.programType === "MEMBERSHIP"
            const isPoints = enrollment.programType === "POINTS"
            const pointsConfig = isPoints ? parsePointsConfig(enrollment.programConfig) : null
            const cheapestItem = pointsConfig ? getCheapestCatalogItem(pointsConfig) : null
            const pointsBalance = enrollment.pointsBalance ?? 0
            const pct = isCoupon || isMembership
              ? 100
              : isPoints
                ? cheapestItem
                  ? Math.min((pointsBalance / cheapestItem.pointsCost) * 100, 100)
                  : 0
                : Math.min(
                    (enrollment.currentCycleVisits / enrollment.visitsRequired) * 100,
                    100
                  )

            return (
              <button
                key={enrollment.enrollmentId}
                type="button"
                className="flex items-center gap-3 w-full rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-brand/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onSelect(enrollment)}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                  {isMembership ? (
                    <Crown className="size-5 text-brand" />
                  ) : isCoupon ? (
                    <Ticket className="size-5 text-brand" />
                  ) : isPoints ? (
                    <Coins className="size-5 text-brand" />
                  ) : (
                    <CreditCard className="size-5 text-brand" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold truncate">
                      {enrollment.programName}
                    </p>
                    {isCoupon && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                        Coupon
                      </span>
                    )}
                    {isMembership && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                        Membership
                      </span>
                    )}
                    {isPoints && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                        {pointsBalance} pts
                      </span>
                    )}
                  </div>
                  {isMembership ? (
                    <p className="text-[12px] text-muted-foreground mt-1">
                      Member
                    </p>
                  ) : isCoupon ? (
                    <p className="text-[12px] font-medium text-success mt-1">
                      Ready to redeem
                    </p>
                  ) : isPoints ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-30">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                        {cheapestItem ? `${pointsBalance}/${cheapestItem.pointsCost} for reward` : `${pointsBalance} pts`}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-30">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[12px] font-medium tabular-nums text-brand">
                        {enrollment.currentCycleVisits}/{enrollment.visitsRequired}
                      </span>
                    </div>
                  )}
                </div>
                <ArrowLeft className="size-4 text-muted-foreground rotate-180 shrink-0" />
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Confirm Step ───────────────────────────────────────────

type ConfirmStepCardDesign = {
  cardType: string
  primaryColor: string | null
  secondaryColor: string | null
  textColor: string | null
  showStrip?: boolean
  patternStyle?: string | null
  progressStyle?: string | null
  labelFormat?: string | null
  customProgressLabel?: string | null
  stripImageUrl?: string | null
  editorConfig?: unknown
} | null

function ConfirmStep({
  customer,
  enrollment,
  isRegistering,
  onConfirm,
  onConfirmCoupon,
  onConfirmCheckIn,
  onEarnPoints,
  onRedeemPoints,
  onBack,
  cardDesign = null,
}: {
  customer: VisitSearchResult
  enrollment: EnrollmentSummary | null
  isRegistering: boolean
  onConfirm: () => void
  onConfirmCoupon: () => void
  onConfirmCheckIn: () => void
  onEarnPoints: () => void
  onRedeemPoints: (catalogItemId: string) => void
  onBack: () => void
  /** Card design for the selected enrollment's program. Pass once
   *  EnrollmentSummary includes cardDesign data. */
  cardDesign?: ConfirmStepCardDesign
}) {
  if (!enrollment) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 p-4 pb-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            disabled={isRegistering}
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <DialogTitle className="text-base">No Active Programs</DialogTitle>
        </div>
        <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
          <CreditCard className="size-10 text-muted-foreground/40" />
          <p className="text-[13px] text-muted-foreground">
            {customer.fullName} has no active program enrollments.
          </p>
        </div>
      </div>
    )
  }

  const isCoupon = enrollment.programType === "COUPON"
  const isMembership = enrollment.programType === "MEMBERSHIP"
  const isPoints = enrollment.programType === "POINTS"
  const filled = enrollment.currentCycleVisits
  const nextVisit = filled + 1
  const visitsRequired = enrollment.visitsRequired
  const pointsConfig = isPoints ? parsePointsConfig(enrollment.programConfig) : null
  const pointsBalance = enrollment.pointsBalance ?? 0
  const affordableCatalogItems = pointsConfig
    ? pointsConfig.catalog.filter((item) => pointsBalance >= item.pointsCost)
    : []

  // Build WalletPassDesign from card design data when available
  const visitSf = cardDesign ? parseStripFilters(cardDesign.editorConfig) : { useStampGrid: false, stripColor1: null, stripColor2: null, stripFill: "gradient" as const, patternColor: null, stripImagePosition: { x: 0.5, y: 0.5 }, stripImageZoom: 1 }
  const visitSg = visitSf.useStampGrid || cardDesign?.patternStyle === "STAMP_GRID"
  const resolvedCardType = isMembership ? "TIER" : isCoupon ? "COUPON" : isPoints ? "POINTS" : "STAMP"
  const design: WalletPassDesign | null = cardDesign
    ? {
        cardType: resolvedCardType as WalletPassDesign["cardType"],
        showStrip: cardDesign.showStrip ?? true,
        primaryColor: cardDesign.primaryColor ?? "#1a1a2e",
        secondaryColor: cardDesign.secondaryColor ?? "#ffffff",
        textColor: cardDesign.textColor ?? "#ffffff",
        progressStyle: (cardDesign.progressStyle ?? "NUMBERS") as WalletPassDesign["progressStyle"],
        labelFormat: (cardDesign.labelFormat ?? "UPPERCASE") as WalletPassDesign["labelFormat"],
        customProgressLabel: cardDesign.customProgressLabel ?? null,
        stripImageUrl: cardDesign.stripImageUrl ?? null,
        patternStyle: (cardDesign.patternStyle === "STAMP_GRID" ? "NONE" : cardDesign.patternStyle ?? "NONE") as WalletPassDesign["patternStyle"],
        useStampGrid: visitSg,
        stripColor1: visitSf.stripColor1 ?? null,
        stripColor2: visitSf.stripColor2 ?? null,
        stripFill: visitSf.stripFill ?? "gradient",
        patternColor: visitSf.patternColor ?? null,
        stripImagePosition: visitSf.stripImagePosition,
        stripImageZoom: visitSf.stripImageZoom,
        stampGridConfig: visitSg
          ? parseStampGridConfig(cardDesign.editorConfig)
          : undefined,
      }
    : null

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 pb-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          disabled={isRegistering}
          aria-label="Go back"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <DialogTitle className="text-base">
          {isMembership ? "Member Check-in" : isCoupon ? "Redeem Coupon" : isPoints ? "Points" : "Confirm Visit"}
        </DialogTitle>
      </div>

      {/* Customer info */}
      <div className="flex flex-col items-center gap-3 pt-6 pb-4 px-4">
        <div
          className="flex size-16 items-center justify-center rounded-full text-lg font-semibold text-white"
          style={{ backgroundColor: getAvatarColor(customer.fullName) }}
        >
          {getInitials(customer.fullName)}
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold">{customer.fullName}</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {isMembership
              ? `${enrollment.programName} — Member Check-in`
              : isCoupon
                ? `${enrollment.programName} — Coupon Redemption`
                : isPoints
                  ? `${enrollment.programName} — ${pointsBalance} pts balance`
                  : `${enrollment.programName} — Visit #${enrollment.totalVisits + 1} — ${nextVisit}/${visitsRequired} in current cycle`}
          </p>
        </div>
      </div>

      {/* Card preview */}
      {design ? (
        <div className="flex justify-center px-6">
          <WalletPassRenderer
            design={design}
            format="apple"
            programName={enrollment.programName}
            restaurantName=""
            customerName={customer.fullName}
            currentVisits={isCoupon || isMembership || isPoints ? 1 : nextVisit}
            totalVisits={isCoupon || isMembership || isPoints ? 1 : visitsRequired}
            rewardDescription=""
            compact
            width={280}
          />
        </div>
      ) : isMembership ? (
        <div className="px-6">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-6">
            <Crown className="size-10 text-brand" />
            <p className="text-[13px] font-medium text-center">Member Check-in</p>
          </div>
        </div>
      ) : isCoupon ? (
        <div className="px-6">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-6">
            <Ticket className="size-10 text-brand" />
            <p className="text-[13px] font-medium text-center">Ready to redeem</p>
          </div>
        </div>
      ) : isPoints ? (
        <div className="px-6">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-4">
            <Coins className="size-8 text-brand" />
            <p className="text-[22px] font-bold tabular-nums text-brand">{pointsBalance} pts</p>
            {pointsConfig && (
              <p className="text-[12px] text-muted-foreground">
                +{pointsConfig.pointsPerVisit} pts per visit
              </p>
            )}
          </div>
        </div>
      ) : (
        <StampCard filled={filled} total={visitsRequired} highlightNext />
      )}

      {/* Confirm button(s) */}
      {isPoints ? (
        <div className="p-4 pt-4 space-y-3">
          {/* Primary: earn points */}
          <Button
            className="w-full h-11 text-[14px] font-medium gap-2"
            onClick={onEarnPoints}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Coins className="size-4" />
            )}
            {pointsConfig ? `Earn +${pointsConfig.pointsPerVisit} pts` : "Earn Points"}
          </Button>

          {/* Secondary: redeem catalog */}
          {pointsConfig && pointsConfig.catalog.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <p className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
                Redeem a reward
              </p>
              <div className="divide-y divide-border">
                {pointsConfig.catalog.map((item) => {
                  const canAfford = pointsBalance >= item.pointsCost
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-3 py-2.5 ${canAfford ? "" : "opacity-50"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{item.name}</p>
                        {item.description && (
                          <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                        )}
                        <p className="text-[11px] font-semibold text-brand tabular-nums">
                          {item.pointsCost} pts
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={canAfford ? "default" : "outline"}
                        className="shrink-0 h-7 text-[12px] px-2.5"
                        onClick={() => onRedeemPoints(item.id)}
                        disabled={isRegistering || !canAfford}
                      >
                        {isRegistering ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          "Redeem"
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 pt-6">
          <Button
            className="w-full h-11 text-[14px] font-medium gap-2"
            onClick={isMembership ? onConfirmCheckIn : isCoupon ? onConfirmCoupon : onConfirm}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isMembership ? (
              <Crown className="size-4" />
            ) : isCoupon ? (
              <Ticket className="size-4" />
            ) : (
              <Stamp className="size-4" />
            )}
            {isMembership ? "Check In" : isCoupon ? "Redeem Coupon" : "Register Visit"}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Stamp Card ─────────────────────────────────────────────

function StampCard({
  filled,
  total,
  highlightNext = false,
  celebrateAll = false,
}: {
  filled: number
  total: number
  highlightNext?: boolean
  celebrateAll?: boolean
}) {
  const gridCols = total <= 5 ? "grid-cols-5" : total <= 8 ? "grid-cols-4" : "grid-cols-5"

  return (
    <div className="px-6">
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className={`grid ${gridCols} gap-3`}>
          {Array.from({ length: total }, (_, i) => {
            const isFilled = i < filled
            const isNext = highlightNext && i === filled
            const isCelebrate = celebrateAll && i < filled

            return (
              <div
                key={i}
                className={`
                  flex items-center justify-center size-10 rounded-full mx-auto transition-all duration-300
                  ${
                    isFilled || isCelebrate
                      ? "bg-brand text-brand-foreground scale-100"
                      : isNext
                        ? "bg-brand/20 text-brand border-2 border-brand border-dashed animate-pulse"
                        : "bg-muted/60 text-muted-foreground/40 border border-border"
                  }
                `}
              >
                {isFilled || isCelebrate ? (
                  <Check className="size-4" />
                ) : isNext ? (
                  <Stamp className="size-4" />
                ) : (
                  <span className="text-[11px] font-medium">{i + 1}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Success Step ───────────────────────────────────────────

function SuccessStep({
  customer,
  wasRewardEarned,
  rewardDescription,
  newCycleVisits,
  visitsRequired,
  programName,
  couponResult,
  checkInResult,
  earnPointsResult,
  redeemPointsResult,
  onClose,
}: {
  customer: VisitSearchResult
  wasRewardEarned: boolean
  rewardDescription: string
  newCycleVisits: number
  visitsRequired: number
  programName: string
  couponResult: RedeemCouponResult | null
  checkInResult: CheckInResult | null
  earnPointsResult: EarnPointsResult | null
  redeemPointsResult: RedeemPointsResult | null
  onClose: () => void
}) {
  return (
    <div
      className="flex flex-col items-center py-10 px-6 cursor-pointer"
      onClick={onClose}
    >
      {checkInResult ? (
        <>
          <div className="flex size-20 items-center justify-center rounded-full bg-success/10 animate-[scale-in_0.4s_ease-out]">
            <AnimatedCheckmark />
          </div>
          <p className="text-lg font-semibold mt-6">Check-in Recorded!</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {customer.fullName} — {checkInResult.programName}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5 tabular-nums">
            {checkInResult.totalCheckIns} total check-in{checkInResult.totalCheckIns !== 1 ? "s" : ""}
          </p>
        </>
      ) : couponResult ? (
        <>
          <div className="relative">
            <div className="flex size-20 items-center justify-center rounded-full bg-success/10 animate-[scale-in_0.4s_ease-out]">
              <AnimatedCheckmark />
            </div>
            <ConfettiDots />
          </div>
          <p className="text-xl font-bold mt-6">Coupon Redeemed!</p>
          <p className="text-[13px] text-muted-foreground mt-1 text-center">
            {customer.fullName} — {couponResult.programName}
          </p>
          {couponResult.selectedPrize ? (
            <p className="text-[14px] font-semibold text-brand mt-2">
              {couponResult.selectedPrize}
            </p>
          ) : couponResult.discountText ? (
            <p className="text-[14px] font-semibold text-brand mt-2">
              {couponResult.discountText}
            </p>
          ) : null}
          {couponResult.redemptionLimit === "unlimited" && (
            <p className="text-[11px] text-muted-foreground mt-2">
              A new coupon has been issued automatically
            </p>
          )}
        </>
      ) : redeemPointsResult ? (
        <>
          <div className="relative">
            <div className="flex size-20 items-center justify-center rounded-full bg-success/10 animate-[scale-in_0.4s_ease-out]">
              <PartyPopper className="size-10 text-success animate-[bounce-in_0.5s_ease-out_0.2s_both]" />
            </div>
            <ConfettiDots />
          </div>
          <p className="text-xl font-bold mt-6">Reward Redeemed!</p>
          <p className="text-[13px] text-muted-foreground mt-1 text-center">
            {customer.fullName} — {redeemPointsResult.programName}
          </p>
          {redeemPointsResult.itemName && (
            <p className="text-[14px] font-semibold text-brand mt-2">
              {redeemPointsResult.itemName}
            </p>
          )}
          {redeemPointsResult.pointsSpent !== undefined && redeemPointsResult.newBalance !== undefined && (
            <p className="text-[12px] text-muted-foreground mt-1 tabular-nums">
              -{redeemPointsResult.pointsSpent} pts &mdash; {redeemPointsResult.newBalance} pts remaining
            </p>
          )}
        </>
      ) : earnPointsResult ? (
        <>
          <div className="flex size-20 items-center justify-center rounded-full bg-brand/10 animate-[scale-in_0.4s_ease-out]">
            <Coins className="size-10 text-brand animate-[bounce-in_0.5s_ease-out_0.2s_both]" />
          </div>
          <p className="text-xl font-bold mt-6">Points Earned!</p>
          <p className="text-[13px] text-muted-foreground mt-1 text-center">
            {customer.fullName} — {earnPointsResult.programName}
          </p>
          {earnPointsResult.pointsEarned !== undefined && (
            <p className="text-[18px] font-bold text-brand mt-3 tabular-nums">
              +{earnPointsResult.pointsEarned} pts
            </p>
          )}
          {earnPointsResult.newBalance !== undefined && (
            <p className="text-[12px] text-muted-foreground mt-1 tabular-nums">
              New balance: {earnPointsResult.newBalance} pts
            </p>
          )}
        </>
      ) : wasRewardEarned ? (
        <>
          {/* Celebration animation */}
          <div className="relative">
            <div className="flex size-20 items-center justify-center rounded-full bg-success/10 animate-[scale-in_0.4s_ease-out]">
              <PartyPopper className="size-10 text-success animate-[bounce-in_0.5s_ease-out_0.2s_both]" />
            </div>
            {/* Confetti dots */}
            <ConfettiDots />
          </div>
          <p className="text-xl font-bold mt-6">Reward Earned!</p>
          <p className="text-[13px] text-muted-foreground mt-1 text-center">
            {customer.fullName} completed {programName} and earned:
          </p>
          <p className="text-[14px] font-semibold text-brand mt-2">
            {rewardDescription}
          </p>
        </>
      ) : (
        <>
          {/* Checkmark animation */}
          <div className="flex size-20 items-center justify-center rounded-full bg-success/10 animate-[scale-in_0.4s_ease-out]">
            <AnimatedCheckmark />
          </div>
          <p className="text-lg font-semibold mt-6">Visit Registered!</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {customer.fullName} — {programName}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5 tabular-nums">
            {newCycleVisits}/{visitsRequired} visits in current cycle
          </p>
        </>
      )}
    </div>
  )
}

// ─── Animated Checkmark SVG ─────────────────────────────────

function AnimatedCheckmark() {
  return (
    <svg
      className="size-10 text-success"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2.5}
      stroke="currentColor"
    >
      <path
        d="M5 13l4 4L19 7"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 24,
          strokeDashoffset: 24,
          animation: "draw-check 0.4s ease-out 0.3s forwards",
        }}
      />
    </svg>
  )
}

// ─── Confetti Dots ──────────────────────────────────────────

function ConfettiDots() {
  const dots = [
    { angle: 0, delay: 0, color: "var(--brand)" },
    { angle: 45, delay: 0.05, color: "var(--success)" },
    { angle: 90, delay: 0.1, color: "var(--warning)" },
    { angle: 135, delay: 0.15, color: "var(--brand)" },
    { angle: 180, delay: 0.2, color: "var(--destructive)" },
    { angle: 225, delay: 0.25, color: "var(--success)" },
    { angle: 270, delay: 0.3, color: "var(--warning)" },
    { angle: 315, delay: 0.35, color: "var(--brand)" },
  ]

  return (
    <>
      {dots.map((dot, i) => {
        const rad = (dot.angle * Math.PI) / 180
        const x = Math.cos(rad) * 48
        const y = Math.sin(rad) * 48
        return (
          <div
            key={i}
            className="absolute size-2 rounded-full"
            style={{
              top: `calc(50% + ${y}px)`,
              left: `calc(50% + ${x}px)`,
              marginTop: -4,
              marginLeft: -4,
              backgroundColor: dot.color,
              opacity: 0,
              animation: `confetti-dot 0.6s ease-out ${dot.delay + 0.2}s forwards`,
            }}
          />
        )
      })}
    </>
  )
}
