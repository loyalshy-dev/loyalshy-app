"use client"

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from "react"
import { useTranslations } from "next-intl"
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
  Minus,
  Gift,
  CalendarDays,
  ShieldCheck,
  Bus,
  BadgeCheck,
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
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  searchContactsForStamp as searchContactsForInteraction,
  registerStamp as registerVisit,
  lookupPassInstanceByWalletPassId,
  type StampSearchResult as InteractionSearchResult,
} from "@/server/stamp-actions"
import {
  redeemCoupon,
  checkInMember,
  earnPoints,
  redeemPoints,
  usePrepaid,
  type RedeemCouponResult,
  type CheckInResult,
  type EarnPointsResult,
  type RedeemPointsResult,
  type UsePrepaidResult,
} from "@/server/interaction-actions"
import { chargeGiftCard, type ChargeGiftCardResult } from "@/server/gift-card-actions"
import { scanTicket, type ScanTicketResult } from "@/server/ticket-actions"
import { grantAccess, type GrantAccessResult } from "@/server/access-actions"
import { transitBoard, type TransitBoardResult } from "@/server/transit-actions"
import { verifyId, type VerifyIdResult } from "@/server/business-id-actions"
import type { PassInstanceSummary } from "@/types/pass-instance"
import { QrScannerView } from "@/components/dashboard/qr-scanner-view"
import { buildWalletPassDesign } from "@/lib/wallet/build-wallet-pass-design"
import { parsePointsConfig, parsePrepaidConfig, parseBusinessIdConfig, parseMembershipConfig, parseAccessConfig, getCheapestCatalogItem } from "@/lib/pass-config"
import { WalletPassRenderer } from "@/components/wallet-pass-renderer"

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
  const t = useTranslations("dashboard.registerVisit")
  const [step, setStep] = useState<Step>("search")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<InteractionSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] =
    useState<InteractionSearchResult | null>(null)
  const [selectedPassInstance, setSelectedPassInstance] =
    useState<PassInstanceSummary | null>(null)
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
  const [usePrepaidResult, setUsePrepaidResult] = useState<UsePrepaidResult | null>(null)
  const [giftCardResult, setGiftCardResult] = useState<ChargeGiftCardResult | null>(null)
  const [ticketResult, setTicketResult] = useState<ScanTicketResult | null>(null)
  const [accessResult, setAccessResult] = useState<GrantAccessResult | null>(null)
  const [transitResult, setTransitResult] = useState<TransitBoardResult | null>(null)
  const [verifyIdResult, setVerifyIdResult] = useState<VerifyIdResult | null>(null)
  const [giftCardAmount, setGiftCardAmount] = useState("")
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
          totalInteractions: 0,
          lastInteractionAt: null,
          passInstances: [],
        })
        setSelectedPassInstance(null)
        setStep("search") // Temporary — will update after fetch
        // Fetch full customer data
        searchContactsForInteraction(preselectedCustomerName).then((resp) => {
          const match = resp.contacts.find((r) => r.id === preselectedCustomerId)
          if (match) {
            setSelectedCustomer(match)
            const activePassInstances = match.passInstances.filter(
              (e) => e.status === "ACTIVE"
            )
            if (activePassInstances.length === 1) {
              // Auto-select the only passInstance
              setSelectedPassInstance(activePassInstances[0])
              setStep("confirm")
            } else if (activePassInstances.length > 1) {
              setStep("program")
            } else {
              // No active passInstances
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
        setSelectedPassInstance(null)
        setCouponResult(null)
        setCheckInResult(null)
        setEarnPointsResult(null)
        setRedeemPointsResult(null)
        setUsePrepaidResult(null)
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
      const resp = await searchContactsForInteraction(value)
      setResults(resp.contacts)
      setIsSearching(false)
    }, 300)
  }, [])

  // Select customer -> pick passInstance or go to confirm
  function handleSelectCustomer(customer: InteractionSearchResult) {
    setSelectedCustomer(customer)
    const activePassInstances = customer.passInstances.filter(
      (e) => e.status === "ACTIVE"
    )
    if (activePassInstances.length === 1) {
      // Auto-select the only passInstance
      setSelectedPassInstance(activePassInstances[0])
      setStep("confirm")
    } else if (activePassInstances.length > 1) {
      // Multiple passInstances — show program picker
      setSelectedPassInstance(null)
      setStep("program")
    } else {
      // No active passInstances — still go to confirm (will show message)
      setSelectedPassInstance(null)
      setStep("confirm")
    }
  }

  // Select a program passInstance
  function handleSelectPassInstance(passInstance: PassInstanceSummary) {
    setSelectedPassInstance(passInstance)
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
    if (!selectedPassInstance) return

    startRegister(async () => {
      const result = await registerVisit(selectedPassInstance.passInstanceId)

      if (!result.success) {
        toast.error(result.error ?? "Failed to register visit")
        return
      }

      setWasRewardEarned(result.wasRewardEarned)
      setRewardDescription(result.rewardDescription ?? "")
      setResultVisits({
        newCycleVisits: result.newCycleVisits,
        newTotalVisits: result.newTotalInteractions,
        visitsRequired: result.visitsRequired,
        programName: result.templateName ?? selectedPassInstance.templateName,
      })

      // Haptic feedback
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10)
      }

      // Toast feedback
      if (result.wasRewardEarned) {
        toast.success(
          t("stampAdded", { name: selectedCustomer?.fullName ?? "" }),
          { description: result.rewardDescription }
        )
      } else {
        toast.success(t("stampAdded", { name: selectedCustomer?.fullName ?? "" }))
      }

      {
        setStep("success")
        autoDismiss()
      }
    })
  }

  // Confirm coupon redemption
  function handleConfirmCoupon() {
    if (!selectedPassInstance) return

    startRegister(async () => {
      const result = await redeemCoupon(selectedPassInstance.passInstanceId)

      if (!result.success) {
        toast.error(result.error ?? "Failed to redeem coupon")
        return
      }

      setCouponResult(result)

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10)
      }

      toast.success(
        t("couponRedeemed", { name: selectedCustomer?.fullName ?? "" }),
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
    if (!selectedPassInstance) return

    startRegister(async () => {
      const result = await checkInMember(selectedPassInstance.passInstanceId)

      if (!result.success) {
        toast.error(result.error ?? "Failed to record check-in")
        return
      }

      setCheckInResult(result)
      setStep("success")

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10)
      }

      toast.success(t("stampAdded", { name: selectedCustomer?.fullName ?? "" }))

      autoDismiss()
    })
  }

  // Earn points for a POINTS program visit
  function handleEarnPoints() {
    if (!selectedPassInstance) return

    startRegister(async () => {
      const result = await earnPoints(selectedPassInstance.passInstanceId)

      if (!result.success) {
        toast.error(result.error ?? "Failed to earn points")
        return
      }

      setEarnPointsResult(result)

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10)
      }

      toast.success(
        t("pointsAdded", { points: result.pointsEarned ?? 0, name: selectedCustomer?.fullName ?? "" }),
        { description: `New balance: ${result.newBalance} pts` }
      )

      setStep("success")
      autoDismiss()
    })
  }

  // Redeem a catalog item for a POINTS program
  function handleRedeemPoints(catalogItemId: string) {
    if (!selectedPassInstance) return

    startRegister(async () => {
      const result = await redeemPoints(selectedPassInstance.passInstanceId, catalogItemId)

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

  // Use one prepaid unit
  function handleUsePrepaid() {
    if (!selectedPassInstance) return

    startRegister(async () => {
      const result = await usePrepaid(selectedPassInstance.passInstanceId)

      if (!result.success) {
        toast.error(result.error ?? "Failed to use prepaid pass")
        return
      }

      setUsePrepaidResult(result)

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10)
      }

      toast.success(
        `${result.useLabel} used for ${selectedCustomer?.fullName}`,
        { description: `${result.remainingUses} remaining` }
      )

      setStep("success")
      autoDismiss()
    })
  }

  // Charge gift card
  function handleChargeGiftCard() {
    if (!selectedPassInstance) return
    const amountCents = Math.round(parseFloat(giftCardAmount) * 100)
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    startRegister(async () => {
      const result = await chargeGiftCard(selectedPassInstance.passInstanceId, amountCents)
      if (!result.success) { toast.error(result.error ?? "Failed to charge gift card"); return }
      setGiftCardResult(result)
      toast.success(`Charged ${(amountCents / 100).toFixed(2)} ${result.currency}`)
      setStep("success")
      autoDismiss()
    })
  }

  // Scan ticket
  function handleScanTicket() {
    if (!selectedPassInstance) return
    startRegister(async () => {
      const result = await scanTicket(selectedPassInstance.passInstanceId)
      if (!result.success) { toast.error(result.error ?? "Failed to scan ticket"); return }
      setTicketResult(result)
      toast.success(`Ticket scanned — ${result.eventName}`, { description: `Scan ${result.scanCount}/${result.maxScans}` })
      setStep("success")
      autoDismiss()
    })
  }

  // Grant access
  function handleGrantAccess() {
    if (!selectedPassInstance) return
    startRegister(async () => {
      const result = await grantAccess(selectedPassInstance.passInstanceId)
      if (!result.success) { toast.error(result.error ?? "Failed to grant access"); return }
      setAccessResult(result)
      toast.success(`${result.accessLabel} granted for ${selectedCustomer?.fullName}`)
      setStep("success")
      autoDismiss()
    })
  }

  // Transit board
  function handleTransitBoard() {
    if (!selectedPassInstance) return
    startRegister(async () => {
      const result = await transitBoard(selectedPassInstance.passInstanceId)
      if (!result.success) { toast.error(result.error ?? "Failed to board"); return }
      setTransitResult(result)
      toast.success("Boarded successfully")
      setStep("success")
      autoDismiss()
    })
  }

  // Verify ID
  function handleVerifyId() {
    if (!selectedPassInstance) return
    startRegister(async () => {
      const result = await verifyId(selectedPassInstance.passInstanceId)
      if (!result.success) { toast.error(result.error ?? "Failed to verify ID"); return }
      setVerifyIdResult(result)
      toast.success(`${result.idLabel} verified for ${result.contactName}`)
      setStep("success")
      autoDismiss()
    })
  }

  // QR scan result handler
  async function handleScanResult(data: string) {
    setScanError(null)
    setIsScanLooking(true)

    const result = await lookupPassInstanceByWalletPassId(data)

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
    setSelectedCustomer(result.contact!)
    setSelectedPassInstance(result.passInstance!)
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
        setSelectedPassInstance(null)
      } else {
        setStep("search")
        setSelectedCustomer(null)
        setSelectedPassInstance(null)
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }
    } else if (step === "confirm") {
      if (wasScanned) {
        // Return to scan mode
        setWasScanned(false)
        setScanMode(true)
        setStep("search")
        setSelectedCustomer(null)
        setSelectedPassInstance(null)
      } else {
        const activePassInstances = selectedCustomer?.passInstances.filter(
          (e) => e.status === "ACTIVE"
        ) ?? []
        if (activePassInstances.length > 1) {
          // Go back to program picker
          setSelectedPassInstance(null)
          setStep("program")
        } else {
          // Go back to search
          setStep("search")
          setSelectedCustomer(null)
          setSelectedPassInstance(null)
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
              <DialogTitle className="text-base">{t("scanQr")}</DialogTitle>
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
            onSelect={handleSelectPassInstance}
            onBack={handleBack}
          />
        )}
        {step === "confirm" && selectedCustomer && (
          <ConfirmStep
            customer={selectedCustomer}
            passInstance={selectedPassInstance}
            isRegistering={isRegistering}
            onConfirm={handleConfirm}
            onConfirmCoupon={handleConfirmCoupon}
            onConfirmCheckIn={handleConfirmCheckIn}
            onEarnPoints={handleEarnPoints}
            onRedeemPoints={handleRedeemPoints}
            onUsePrepaid={handleUsePrepaid}
            onChargeGiftCard={handleChargeGiftCard}
            onScanTicket={handleScanTicket}
            onGrantAccess={handleGrantAccess}
            onTransitBoard={handleTransitBoard}
            onVerifyId={handleVerifyId}
            giftCardAmount={giftCardAmount}
            onGiftCardAmountChange={setGiftCardAmount}
            onBack={handleBack}
            cardDesign={selectedPassInstance?.passDesign ?? null}
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
            usePrepaidResult={usePrepaidResult}
            giftCardResult={giftCardResult}
            ticketResult={ticketResult}
            accessResult={accessResult}
            transitResult={transitResult}
            verifyIdResult={verifyIdResult}
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
  results: InteractionSearchResult[]
  isSearching: boolean
  searchInputRef: React.RefObject<HTMLInputElement | null>
  onSearch: (value: string) => void
  onSelect: (customer: InteractionSearchResult) => void
  hasCamera: boolean | null
  onScanMode: () => void
}) {
  const t = useTranslations("dashboard.registerVisit")
  return (
    <div className="flex flex-col h-full">
      <DialogHeader className="p-4 pb-0">
        <DialogTitle className="text-base">{t("title")}</DialogTitle>
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

      <ScrollArea className="flex-1 max-h-[50vh] min-h-30">
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
                // Show primary passInstance progress
                const activePassInstances = customer.passInstances.filter(
                  (e) => e.status === "ACTIVE"
                )
                const primary = activePassInstances[0]
                const primaryData = primary
                  ? (primary.data as Record<string, unknown> | null ?? {})
                  : null
                const primaryCycleVisits = primaryData
                  ? ((primaryData.currentCycleVisits as number) ?? 0)
                  : 0
                const primaryConfig = primary?.templateConfig as Record<string, unknown> | null ?? {}
                const primaryVisitsRequired = (primaryConfig?.stampsRequired as number) ?? 10

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
                      {primary && primary.passType === "STAMP_CARD" ? (
                        <>
                          <p className="text-[13px] font-semibold tabular-nums text-brand">
                            {primaryCycleVisits}/{primaryVisitsRequired}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-25">
                            {activePassInstances.length > 1
                              ? `${activePassInstances.length} programs`
                              : primary.templateName}
                          </p>
                        </>
                      ) : primary ? (
                        <p className="text-[11px] text-muted-foreground truncate max-w-25">
                          {activePassInstances.length > 1
                            ? `${activePassInstances.length} programs`
                            : primary.templateName}
                        </p>
                      ) : customer.lastInteractionAt ? (
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(customer.lastInteractionAt), {
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
    </div>
  )
}

// ─── Program Picker Step ────────────────────────────────────

function ProgramPickerStep({
  customer,
  onSelect,
  onBack,
}: {
  customer: InteractionSearchResult
  onSelect: (passInstance: PassInstanceSummary) => void
  onBack: () => void
}) {
  const activePassInstances = customer.passInstances.filter(
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
            {activePassInstances.length} active program{activePassInstances.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Program cards */}
      <ScrollArea className="max-h-[50vh] min-h-30">
        <div className="px-4 py-3 space-y-2">
          {activePassInstances.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No active programs</p>
            </div>
          )}
          {activePassInstances.map((passInstance) => {
            const isCoupon = passInstance.passType === "COUPON"
            const isMembership = passInstance.passType === "MEMBERSHIP"
            const isPoints = passInstance.passType === "POINTS"
            const isPrepaid = passInstance.passType === "PREPAID"
            const instanceData = passInstance.data as Record<string, unknown> | null ?? {}
            const templateConfig = passInstance.templateConfig as Record<string, unknown> | null ?? {}
            const pointsConfig = isPoints ? parsePointsConfig(passInstance.templateConfig) : null
            const cheapestItem = pointsConfig ? getCheapestCatalogItem(pointsConfig) : null
            const pointsBalance = (instanceData.pointsBalance as number) ?? 0
            const remainingUses = (instanceData.remainingUses as number) ?? 0
            const prepaidConfig = isPrepaid ? parsePrepaidConfig(passInstance.templateConfig) : null
            const totalUses = prepaidConfig?.totalUses ?? 0
            const currentCycleVisits = (instanceData.currentCycleVisits as number) ?? 0
            const visitsRequired = (templateConfig.stampsRequired as number) ?? 10
            const pct = isCoupon || isMembership
              ? 100
              : isPrepaid
                ? totalUses > 0 ? Math.min((remainingUses / totalUses) * 100, 100) : 0
                : isPoints
                  ? cheapestItem
                    ? Math.min((pointsBalance / cheapestItem.pointsCost) * 100, 100)
                    : 0
                  : Math.min(
                      (currentCycleVisits / visitsRequired) * 100,
                      100
                    )

            return (
              <Card asChild key={passInstance.passInstanceId}>
              <button
                type="button"
                className="flex items-center gap-3 w-full p-4 text-left transition-all hover:bg-muted/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onSelect(passInstance)}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                  {isMembership ? (
                    <Crown className="size-5 text-brand" />
                  ) : isCoupon ? (
                    <Ticket className="size-5 text-brand" />
                  ) : isPoints ? (
                    <Coins className="size-5 text-brand" />
                  ) : isPrepaid ? (
                    <CreditCard className="size-5 text-brand" />
                  ) : passInstance.passType === "GIFT_CARD" ? (
                    <Gift className="size-5 text-brand" />
                  ) : passInstance.passType === "TICKET" ? (
                    <CalendarDays className="size-5 text-brand" />
                  ) : passInstance.passType === "ACCESS" ? (
                    <ShieldCheck className="size-5 text-brand" />
                  ) : passInstance.passType === "TRANSIT" ? (
                    <Bus className="size-5 text-brand" />
                  ) : passInstance.passType === "BUSINESS_ID" ? (
                    <BadgeCheck className="size-5 text-brand" />
                  ) : (
                    <Stamp className="size-5 text-brand" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold truncate">
                      {passInstance.templateName}
                    </p>
                    {isCoupon && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                        Coupon
                      </span>
                    )}
                    {isMembership && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                        {passInstance.status === "SUSPENDED" ? "Suspended" : "Member"}
                      </span>
                    )}
                    {isPoints && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                        {pointsBalance} pts
                      </span>
                    )}
                    {isPrepaid && (
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${remainingUses <= 0 ? "bg-destructive/10 text-destructive" : "bg-brand/10 text-brand"}`}>
                        {remainingUses}/{totalUses}
                      </span>
                    )}
                  </div>
                  {isMembership ? (
                    <p className={`text-[12px] mt-1 ${passInstance.status === "SUSPENDED" ? "text-destructive" : "text-muted-foreground"}`}>
                      {passInstance.status === "SUSPENDED" ? "Suspended" : "Member"}
                    </p>
                  ) : isCoupon ? (
                    <p className="text-[12px] font-medium text-success mt-1">
                      Ready to redeem
                    </p>
                  ) : isPrepaid ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-30">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-[12px] font-medium tabular-nums ${remainingUses <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {remainingUses} {prepaidConfig?.useLabel ?? "use"}{remainingUses !== 1 ? "s" : ""} left
                      </span>
                    </div>
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
                        {currentCycleVisits}/{visitsRequired}
                      </span>
                    </div>
                  )}
                </div>
                <ArrowLeft className="size-4 text-muted-foreground rotate-180 shrink-0" />
              </button>
              </Card>
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
  passInstance,
  isRegistering,
  onConfirm,
  onConfirmCoupon,
  onConfirmCheckIn,
  onEarnPoints,
  onRedeemPoints,
  onUsePrepaid,
  onChargeGiftCard,
  onScanTicket,
  onGrantAccess,
  onTransitBoard,
  onVerifyId,
  giftCardAmount,
  onGiftCardAmountChange,
  onBack,
  cardDesign = null,
}: {
  customer: InteractionSearchResult
  passInstance: PassInstanceSummary | null
  isRegistering: boolean
  onConfirm: () => void
  onConfirmCoupon: () => void
  onConfirmCheckIn: () => void
  onEarnPoints: () => void
  onRedeemPoints: (catalogItemId: string) => void
  onUsePrepaid: () => void
  onChargeGiftCard: () => void
  onScanTicket: () => void
  onGrantAccess: () => void
  onTransitBoard: () => void
  onVerifyId: () => void
  giftCardAmount: string
  onGiftCardAmountChange: (val: string) => void
  onBack: () => void
  cardDesign?: ConfirmStepCardDesign
}) {
  const t = useTranslations("dashboard.registerVisit")

  if (!passInstance) {
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
            {customer.fullName} has no active pass instances.
          </p>
        </div>
      </div>
    )
  }

  const isCoupon = passInstance.passType === "COUPON"
  const isMembership = passInstance.passType === "MEMBERSHIP"
  const isPoints = passInstance.passType === "POINTS"
  const isPrepaid = passInstance.passType === "PREPAID"
  const isGiftCard = passInstance.passType === "GIFT_CARD"
  const isTicket = passInstance.passType === "TICKET"
  const isAccess = passInstance.passType === "ACCESS"
  const isTransit = passInstance.passType === "TRANSIT"
  const isBusinessId = passInstance.passType === "BUSINESS_ID"
  const confirmData = passInstance.data as Record<string, unknown> | null ?? {}
  const confirmConfig = passInstance.templateConfig as Record<string, unknown> | null ?? {}
  const filled = (confirmData.currentCycleVisits as number) ?? 0
  const nextVisit = filled + 1
  const visitsRequired = (confirmConfig.stampsRequired as number) ?? 10
  const totalVisitsFromData = (confirmData.totalVisits as number) ?? 0
  const pointsConfig = isPoints ? parsePointsConfig(passInstance.templateConfig) : null
  const pointsBalance = (confirmData.pointsBalance as number) ?? 0
  const affordableCatalogItems = pointsConfig
    ? pointsConfig.catalog.filter((item) => pointsBalance >= item.pointsCost)
    : []
  const prepaidConfig = isPrepaid ? parsePrepaidConfig(passInstance.templateConfig) : null
  const remainingUses = (confirmData.remainingUses as number) ?? 0
  const totalUses = prepaidConfig?.totalUses ?? 0
  const giftBalanceCents = (confirmData.balanceCents as number) ?? 0
  const giftCurrency = (confirmData.currency as string) ?? "USD"
  const ticketScanCount = (confirmData.scanCount as number) ?? 0
  const ticketMaxScans = (confirmConfig.maxScans as number) ?? 1

  // Build WalletPassDesign from card design data when available
  const design = cardDesign ? buildWalletPassDesign(cardDesign) : null
  const businessIdCfg = isBusinessId ? parseBusinessIdConfig(passInstance.templateConfig) : null
  const membershipCfg = isMembership ? parseMembershipConfig(passInstance.templateConfig) : null
  const accessCfg = isAccess ? parseAccessConfig(passInstance.templateConfig) : null
  const holderPhotoUrl = (isBusinessId || isMembership || isAccess)
    ? (typeof confirmData.holderPhotoUrl === "string" ? confirmData.holderPhotoUrl : undefined)
    : undefined

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
          {isMembership ? t("checkIn") : isCoupon ? t("redeemCoupon") : isPoints ? t("addPoints") : isPrepaid ? t("charge") : isGiftCard ? t("charge") : isTicket ? t("scanTicket") : isAccess ? t("grantAccess") : isTransit ? t("recharge") : isBusinessId ? "Verify ID" : t("registerStamp")}
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
              ? `${passInstance.templateName} — Member Check-in`
              : isCoupon
                ? `${passInstance.templateName} — Coupon Redemption`
                : isPrepaid
                  ? `${passInstance.templateName} — ${remainingUses}/${totalUses} ${prepaidConfig?.useLabel ?? "use"}${remainingUses !== 1 ? "s" : ""} remaining`
                  : isPoints
                    ? `${passInstance.templateName} — ${pointsBalance} pts balance`
                    : isGiftCard
                      ? `${passInstance.templateName} — ${(giftBalanceCents / 100).toFixed(2)} ${giftCurrency} balance`
                      : isTicket
                        ? `${passInstance.templateName} — ${ticketScanCount}/${ticketMaxScans} scans`
                        : isAccess
                          ? `${passInstance.templateName} — Access Pass`
                          : isTransit
                            ? `${passInstance.templateName} — Transit Pass`
                            : isBusinessId
                              ? `${passInstance.templateName} — ID Verification`
                              : `${passInstance.templateName} — Visit #${totalVisitsFromData + 1} — ${nextVisit}/${visitsRequired} in current cycle`}
          </p>
        </div>
      </div>

      {/* Card preview */}
      {design ? (
        <div className="flex justify-center px-6">
          <WalletPassRenderer
            design={design}
            format="apple"
            programName={passInstance.templateName}
            customerName={customer.fullName}
            logoUrl={passInstance.passDesign?.logoUrl}
            logoAppleUrl={passInstance.passDesign?.logoAppleUrl}
            logoGoogleUrl={passInstance.passDesign?.logoGoogleUrl}
            currentVisits={isCoupon || isMembership || isPoints ? 1 : isPrepaid ? remainingUses : nextVisit}
            totalVisits={isCoupon || isMembership || isPoints ? 1 : isPrepaid ? totalUses : visitsRequired}
            rewardDescription=""
            compact
            width={280}
            showHolderPhoto={businessIdCfg?.showHolderPhoto ?? membershipCfg?.showHolderPhoto ?? accessCfg?.showHolderPhoto ?? (isBusinessId ? true : undefined)}
            holderPhotoPosition={businessIdCfg?.holderPhotoPosition ?? membershipCfg?.holderPhotoPosition ?? accessCfg?.holderPhotoPosition}
            holderPhotoUrl={holderPhotoUrl}
            idLabel={businessIdCfg?.idLabel}
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
      ) : isPrepaid ? (
        <div className="px-6">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-4">
            <CreditCard className="size-8 text-brand" />
            <p className="text-[22px] font-bold tabular-nums text-brand">
              {remainingUses} / {totalUses}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {prepaidConfig?.useLabel ?? "use"}{remainingUses !== 1 ? "s" : ""} remaining
            </p>
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
            <Card className="overflow-hidden">
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
            </Card>
          )}
        </div>
      ) : isGiftCard ? (
        <div className="p-4 pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder={t("amount")}
              value={giftCardAmount}
              onChange={(e) => onGiftCardAmountChange(e.target.value)}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">{giftCurrency}</span>
          </div>
          <Button
            className="w-full h-11 text-[14px] font-medium gap-2"
            onClick={onChargeGiftCard}
            disabled={isRegistering || giftBalanceCents <= 0}
          >
            {isRegistering ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
            {t("charge")}
          </Button>
        </div>
      ) : (
        <div className="p-4 pt-6">
          <Button
            className="w-full h-11 text-[14px] font-medium gap-2"
            onClick={
              isPrepaid ? onUsePrepaid
              : isMembership ? onConfirmCheckIn
              : isCoupon ? onConfirmCoupon
              : isTicket ? onScanTicket
              : isAccess ? onGrantAccess
              : isTransit ? onTransitBoard
              : isBusinessId ? onVerifyId
              : onConfirm
            }
            disabled={isRegistering || (isPrepaid && remainingUses <= 0) || (isTicket && ticketScanCount >= ticketMaxScans)}
          >
            {isRegistering ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPrepaid ? (
              <Minus className="size-4" />
            ) : isMembership ? (
              <Crown className="size-4" />
            ) : isCoupon ? (
              <Ticket className="size-4" />
            ) : isTicket ? (
              <CalendarDays className="size-4" />
            ) : isAccess ? (
              <ShieldCheck className="size-4" />
            ) : isTransit ? (
              <Bus className="size-4" />
            ) : isBusinessId ? (
              <BadgeCheck className="size-4" />
            ) : (
              <Stamp className="size-4" />
            )}
            {isPrepaid
              ? remainingUses <= 0 ? "Depleted" : `Use 1 ${prepaidConfig?.useLabel ?? "use"}`
              : isMembership ? t("checkIn")
              : isCoupon ? t("redeemCoupon")
              : isTicket ? (ticketScanCount >= ticketMaxScans ? "Max Scans Reached" : t("scanTicket"))
              : isAccess ? t("grantAccess")
              : isTransit ? t("recharge")
              : isBusinessId ? "Verify ID"
              : t("registerStamp")}
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
  usePrepaidResult,
  giftCardResult,
  ticketResult,
  accessResult,
  transitResult,
  verifyIdResult,
  onClose,
}: {
  customer: InteractionSearchResult
  wasRewardEarned: boolean
  rewardDescription: string
  newCycleVisits: number
  visitsRequired: number
  programName: string
  couponResult: RedeemCouponResult | null
  checkInResult: CheckInResult | null
  earnPointsResult: EarnPointsResult | null
  redeemPointsResult: RedeemPointsResult | null
  usePrepaidResult: UsePrepaidResult | null
  giftCardResult: ChargeGiftCardResult | null
  ticketResult: ScanTicketResult | null
  accessResult: GrantAccessResult | null
  transitResult: TransitBoardResult | null
  verifyIdResult: VerifyIdResult | null
  onClose: () => void
}) {
  return (
    <div
      className="flex flex-col items-center py-10 px-6 cursor-pointer"
      onClick={onClose}
    >
      {usePrepaidResult ? (
        <>
          <div className="flex size-20 items-center justify-center rounded-full bg-success/10 animate-[scale-in_0.4s_ease-out]">
            <AnimatedCheckmark />
          </div>
          <p className="text-lg font-semibold mt-6">
            {usePrepaidResult.isDepleted ? "Pass Depleted!" : "Use Recorded!"}
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {customer.fullName} — {usePrepaidResult.templateName}
          </p>
          <p className={`text-[12px] mt-0.5 tabular-nums ${usePrepaidResult.isDepleted ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {usePrepaidResult.remainingUses}/{usePrepaidResult.totalUses} {usePrepaidResult.useLabel}{usePrepaidResult.remainingUses !== 1 ? "s" : ""} remaining
          </p>
        </>
      ) : checkInResult ? (
        <>
          <div className="flex size-20 items-center justify-center rounded-full bg-success/10 animate-[scale-in_0.4s_ease-out]">
            <AnimatedCheckmark />
          </div>
          <p className="text-lg font-semibold mt-6">Check-in Recorded!</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {customer.fullName} — {checkInResult.templateName}
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
            {customer.fullName} — {couponResult.templateName}
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
            {customer.fullName} — {redeemPointsResult.templateName}
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
            {customer.fullName} — {earnPointsResult.templateName}
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
      ) : giftCardResult ? (
        <>
          <div className="flex size-20 items-center justify-center rounded-full bg-success/10 animate-[scale-in_0.4s_ease-out]">
            <AnimatedCheckmark />
          </div>
          <p className="text-lg font-semibold mt-6">Gift Card Charged!</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {customer.fullName} — {giftCardResult.templateName}
          </p>
          <p className="text-[14px] font-semibold text-brand mt-2 tabular-nums">
            {((giftCardResult.amountCharged ?? 0) / 100).toFixed(2)} {giftCardResult.currency}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5 tabular-nums">
            Remaining: {((giftCardResult.newBalanceCents ?? 0) / 100).toFixed(2)} {giftCardResult.currency}
          </p>
        </>
      ) : ticketResult ? (
        <>
          <div className="flex size-20 items-center justify-center rounded-full bg-success/10 animate-[scale-in_0.4s_ease-out]">
            <AnimatedCheckmark />
          </div>
          <p className="text-lg font-semibold mt-6">Ticket Scanned!</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {customer.fullName} — {ticketResult.eventName}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5 tabular-nums">
            Scan {ticketResult.scanCount}/{ticketResult.maxScans}
            {ticketResult.isMaxedOut && " — Fully used"}
          </p>
        </>
      ) : accessResult ? (
        <>
          <div className="flex size-20 items-center justify-center rounded-full bg-success/10 animate-[scale-in_0.4s_ease-out]">
            <ShieldCheck className="size-10 text-success animate-[bounce-in_0.5s_ease-out_0.2s_both]" />
          </div>
          <p className="text-lg font-semibold mt-6">Access Granted!</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {customer.fullName} — {accessResult.accessLabel}
          </p>
        </>
      ) : transitResult ? (
        <>
          <div className="flex size-20 items-center justify-center rounded-full bg-success/10 animate-[scale-in_0.4s_ease-out]">
            <Bus className="size-10 text-success animate-[bounce-in_0.5s_ease-out_0.2s_both]" />
          </div>
          <p className="text-lg font-semibold mt-6">Boarded!</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {customer.fullName} — {transitResult.templateName}
          </p>
        </>
      ) : verifyIdResult ? (
        <>
          <div className="flex size-20 items-center justify-center rounded-full bg-success/10 animate-[scale-in_0.4s_ease-out]">
            <BadgeCheck className="size-10 text-success animate-[bounce-in_0.5s_ease-out_0.2s_both]" />
          </div>
          <p className="text-lg font-semibold mt-6">ID Verified!</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {verifyIdResult.contactName} — {verifyIdResult.idLabel}
          </p>
          <p className="text-[12px] text-muted-foreground mt-0.5 tabular-nums">
            {verifyIdResult.totalVerifications} total verification{verifyIdResult.totalVerifications !== 1 ? "s" : ""}
          </p>
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
