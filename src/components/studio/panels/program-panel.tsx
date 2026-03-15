"use client"

import { useState } from "react"
import { useStore } from "zustand"
import type { CardDesignStoreApi } from "@/lib/stores/card-design-store"

// ─── Shared field components ─────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: "var(--muted-foreground)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginTop: 16,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  )
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  maxLength?: number
  type?: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 4 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 9999,
          border: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          fontSize: 12,
          color: "var(--foreground)",
          outline: "none",
        }}
      />
    </div>
  )
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          style={{
            width: suffix ? "70%" : "100%",
            padding: "8px 10px",
            borderRadius: 9999,
            border: "1px solid var(--border)",
            backgroundColor: "var(--background)",
            fontSize: 12,
            color: "var(--foreground)",
            outline: "none",
          }}
        />
        {suffix && (
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{suffix}</span>
        )}
      </div>
    </div>
  )
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 4 }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          fontSize: 12,
          color: "var(--foreground)",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function ToggleInput({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 10,
        cursor: "pointer",
      }}
      onClick={() => onChange(!value)}
    >
      <div>
        <div style={{ fontSize: 12, color: "var(--foreground)" }}>{label}</div>
        {description && (
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
      <div
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          backgroundColor: value ? "var(--primary)" : "var(--muted)",
          position: "relative",
          flexShrink: 0,
          transition: "background-color 0.15s",
          marginTop: 1,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: "white",
            position: "absolute",
            top: 2,
            left: value ? 18 : 2,
            transition: "left 0.15s",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        />
      </div>
    </div>
  )
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows?: number
  maxLength?: number
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 4 }}>{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 3}
        maxLength={maxLength}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          backgroundColor: "var(--background)",
          fontSize: 12,
          color: "var(--foreground)",
          outline: "none",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
    </div>
  )
}

// ─── Type-specific panels ────────────────────────────────────

function StampCardFields({ store }: { store: CardDesignStoreApi }) {
  const stampsRequired = useStore(store, (s) => s.programConfig.stampsRequired)
  const rewardExpiryDays = useStore(store, (s) => s.programConfig.rewardExpiryDays)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>Stamp Card</SectionHeader>
      <NumberInput
        label="Stamps required"
        value={stampsRequired}
        onChange={(v) => set("stampsRequired", Math.max(3, Math.min(10, v)))}
        min={3}
        max={10}
        suffix="stamps"
      />
      <NumberInput
        label="Reward expiry"
        value={rewardExpiryDays}
        onChange={(v) => set("rewardExpiryDays", Math.max(0, v))}
        min={0}
        suffix="days (0 = never)"
      />
    </>
  )
}

function CouponFields({ store }: { store: CardDesignStoreApi }) {
  const discountType = useStore(store, (s) => s.programConfig.discountType)
  const discountValue = useStore(store, (s) => s.programConfig.discountValue)
  const couponCode = useStore(store, (s) => s.programConfig.couponCode)
  const couponDescription = useStore(store, (s) => s.programConfig.couponDescription)
  const validUntil = useStore(store, (s) => s.programConfig.validUntil)
  const redemptionLimit = useStore(store, (s) => s.programConfig.redemptionLimit)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>Coupon</SectionHeader>
      <SelectInput
        label="Discount type"
        value={discountType}
        onChange={(v) => set("discountType", v)}
        options={[
          { value: "percentage", label: "Percentage" },
          { value: "fixed", label: "Fixed amount" },
          { value: "freeItem", label: "Free item" },
          { value: "buyOneGetOne", label: "Buy one get one" },
          { value: "custom", label: "Custom" },
        ]}
      />
      {(discountType === "percentage" || discountType === "fixed") && (
        <NumberInput
          label={discountType === "percentage" ? "Discount %" : "Discount amount"}
          value={discountValue}
          onChange={(v) => set("discountValue", Math.max(0, v))}
          min={0}
          suffix={discountType === "percentage" ? "%" : ""}
        />
      )}
      <TextInput
        label="Coupon code"
        value={couponCode}
        onChange={(v) => set("couponCode", v)}
        placeholder="SAVE10"
        maxLength={50}
      />
      <TextInput
        label="Description"
        value={couponDescription}
        onChange={(v) => set("couponDescription", v)}
        placeholder="10% off your next purchase"
        maxLength={200}
      />
      <TextInput
        label="Valid until"
        value={validUntil}
        onChange={(v) => set("validUntil", v)}
        placeholder=""
        type="date"
      />
      <SelectInput
        label="Redemption limit"
        value={redemptionLimit}
        onChange={(v) => set("redemptionLimit", v)}
        options={[
          { value: "single", label: "Single use" },
          { value: "unlimited", label: "Unlimited" },
        ]}
      />
    </>
  )
}

function MembershipFields({ store }: { store: CardDesignStoreApi }) {
  const membershipTier = useStore(store, (s) => s.programConfig.membershipTier)
  const benefits = useStore(store, (s) => s.programConfig.benefits)
  const validDuration = useStore(store, (s) => s.programConfig.validDuration)
  const customDurationDays = useStore(store, (s) => s.programConfig.customDurationDays)
  const autoRenew = useStore(store, (s) => s.programConfig.autoRenew)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>Membership</SectionHeader>
      <TextInput
        label="Tier name"
        value={membershipTier}
        onChange={(v) => set("membershipTier", v)}
        placeholder="Gold Member"
        maxLength={100}
      />
      <TextArea
        label="Benefits"
        value={benefits}
        onChange={(v) => set("benefits", v)}
        placeholder="10% off all purchases&#10;Early access to sales&#10;Free shipping"
        rows={4}
        maxLength={1000}
      />
      <SelectInput
        label="Duration"
        value={validDuration}
        onChange={(v) => set("validDuration", v)}
        options={[
          { value: "30_days", label: "30 days" },
          { value: "90_days", label: "90 days" },
          { value: "6_months", label: "6 months" },
          { value: "1_year", label: "1 year" },
          { value: "lifetime", label: "Lifetime" },
          { value: "custom", label: "Custom" },
        ]}
      />
      {validDuration === "custom" && (
        <NumberInput
          label="Custom duration"
          value={customDurationDays}
          onChange={(v) => set("customDurationDays", Math.max(1, v))}
          min={1}
          suffix="days"
        />
      )}
      <ToggleInput
        label="Auto-renew"
        description="Automatically renew membership when it expires"
        value={autoRenew}
        onChange={(v) => set("autoRenew", v)}
      />
    </>
  )
}

function PointsFields({ store }: { store: CardDesignStoreApi }) {
  const pointsPerVisit = useStore(store, (s) => s.programConfig.pointsPerVisit)
  const pointsLabel = useStore(store, (s) => s.programConfig.pointsLabel)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>Points</SectionHeader>
      <NumberInput
        label="Points per visit"
        value={pointsPerVisit}
        onChange={(v) => set("pointsPerVisit", Math.max(1, v))}
        min={1}
        suffix={pointsLabel || "pts"}
      />
      <TextInput
        label="Points label"
        value={pointsLabel}
        onChange={(v) => set("pointsLabel", v)}
        placeholder="pts"
        maxLength={20}
      />
    </>
  )
}

function PrepaidFields({ store }: { store: CardDesignStoreApi }) {
  const totalUses = useStore(store, (s) => s.programConfig.totalUses)
  const useLabel = useStore(store, (s) => s.programConfig.useLabel)
  const rechargeable = useStore(store, (s) => s.programConfig.rechargeable)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>Prepaid</SectionHeader>
      <NumberInput
        label="Total uses"
        value={totalUses}
        onChange={(v) => set("totalUses", Math.max(1, v))}
        min={1}
        suffix={`${useLabel}s`}
      />
      <TextInput
        label="Use label"
        value={useLabel}
        onChange={(v) => set("useLabel", v)}
        placeholder="use"
        maxLength={30}
      />
      <ToggleInput
        label="Rechargeable"
        description="Allow pass holders to recharge when depleted"
        value={rechargeable}
        onChange={(v) => set("rechargeable", v)}
      />
    </>
  )
}

function GiftCardFields({ store }: { store: CardDesignStoreApi }) {
  const currency = useStore(store, (s) => s.programConfig.currency)
  const initialBalanceCents = useStore(store, (s) => s.programConfig.initialBalanceCents)
  const partialRedemption = useStore(store, (s) => s.programConfig.partialRedemption)
  const expiryMonths = useStore(store, (s) => s.programConfig.expiryMonths)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>Gift Card</SectionHeader>
      <TextInput
        label="Currency"
        value={currency}
        onChange={(v) => set("currency", v)}
        placeholder="USD"
        maxLength={5}
      />
      <NumberInput
        label="Initial balance (cents)"
        value={initialBalanceCents}
        onChange={(v) => set("initialBalanceCents", Math.max(0, v))}
        min={0}
      />
      <ToggleInput
        label="Partial redemption"
        description="Allow spending part of the balance"
        value={partialRedemption}
        onChange={(v) => set("partialRedemption", v)}
      />
      <NumberInput
        label="Expiry (months)"
        value={expiryMonths}
        onChange={(v) => set("expiryMonths", Math.max(0, v))}
        min={0}
      />
    </>
  )
}

function TicketFields({ store }: { store: CardDesignStoreApi }) {
  const eventName = useStore(store, (s) => s.programConfig.eventName)
  const eventDate = useStore(store, (s) => s.programConfig.eventDate)
  const eventVenue = useStore(store, (s) => s.programConfig.eventVenue)
  const maxScans = useStore(store, (s) => s.programConfig.maxScans)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>Event Ticket</SectionHeader>
      <TextInput
        label="Event name"
        value={eventName}
        onChange={(v) => set("eventName", v)}
        placeholder="Summer Music Festival"
        maxLength={200}
      />
      <TextInput
        label="Event date"
        value={eventDate}
        onChange={(v) => set("eventDate", v)}
        placeholder=""
        type="date"
      />
      <TextInput
        label="Venue"
        value={eventVenue}
        onChange={(v) => set("eventVenue", v)}
        placeholder="Madison Square Garden"
        maxLength={200}
      />
      <NumberInput
        label="Max scans"
        value={maxScans}
        onChange={(v) => set("maxScans", Math.max(1, v))}
        min={1}
      />
    </>
  )
}

const DAYS_OF_WEEK = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
]

function AccessFields({ store }: { store: CardDesignStoreApi }) {
  const accessLabel = useStore(store, (s) => s.programConfig.accessLabel)
  const validDuration = useStore(store, (s) => s.programConfig.validDuration)
  const customDurationDays = useStore(store, (s) => s.programConfig.customDurationDays)
  const maxDailyUses = useStore(store, (s) => s.programConfig.maxDailyUses)
  const validDays = useStore(store, (s) => s.programConfig.validDays)
  const validTimeStart = useStore(store, (s) => s.programConfig.validTimeStart)
  const validTimeEnd = useStore(store, (s) => s.programConfig.validTimeEnd)
  const set = store.getState().setConfigField

  function toggleDay(day: string) {
    const current = validDays ?? []
    if (current.includes(day)) {
      set("validDays", current.filter((d) => d !== day))
    } else {
      set("validDays", [...current, day])
    }
  }

  return (
    <>
      <SectionHeader>Access Pass</SectionHeader>
      <TextInput
        label="Access label"
        value={accessLabel}
        onChange={(v) => set("accessLabel", v)}
        placeholder="VIP Access"
        maxLength={100}
      />
      <SelectInput
        label="Valid duration"
        value={validDuration}
        onChange={(v) => set("validDuration", v)}
        options={[
          { value: "monthly", label: "Monthly" },
          { value: "yearly", label: "Yearly" },
          { value: "lifetime", label: "Lifetime" },
          { value: "custom", label: "Custom" },
        ]}
      />
      {validDuration === "custom" && (
        <NumberInput
          label="Custom duration"
          value={customDurationDays}
          onChange={(v) => set("customDurationDays", Math.max(1, v))}
          min={1}
          suffix="days"
        />
      )}
      <NumberInput
        label="Max daily uses"
        value={maxDailyUses}
        onChange={(v) => set("maxDailyUses", Math.max(0, v))}
        min={0}
        suffix="0 = unlimited"
      />

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "var(--foreground)", marginBottom: 4 }}>Valid days</div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>
          Select none for all days.
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.value}
              onClick={() => toggleDay(day.value)}
              style={{
                padding: "4px 8px",
                borderRadius: 9999,
                border: "1px solid var(--border)",
                backgroundColor: validDays.includes(day.value) ? "var(--primary)" : "var(--background)",
                color: validDays.includes(day.value) ? "var(--primary-foreground)" : "var(--foreground)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: validDays.includes(day.value) ? 600 : 400,
              }}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <TextInput
            label="Valid from"
            value={validTimeStart}
            onChange={(v) => set("validTimeStart", v)}
            placeholder="09:00"
            type="time"
          />
        </div>
        <div style={{ flex: 1 }}>
          <TextInput
            label="Valid until"
            value={validTimeEnd}
            onChange={(v) => set("validTimeEnd", v)}
            placeholder="18:00"
            type="time"
          />
        </div>
      </div>
    </>
  )
}

function TransitFields({ store }: { store: CardDesignStoreApi }) {
  const transitType = useStore(store, (s) => s.programConfig.transitType)
  const originName = useStore(store, (s) => s.programConfig.originName)
  const destinationName = useStore(store, (s) => s.programConfig.destinationName)
  const departureDateTime = useStore(store, (s) => s.programConfig.departureDateTime)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>Transit Pass</SectionHeader>
      <SelectInput
        label="Transit type"
        value={transitType}
        onChange={(v) => set("transitType", v)}
        options={[
          { value: "bus", label: "Bus" },
          { value: "train", label: "Train" },
          { value: "ferry", label: "Ferry" },
          { value: "flight", label: "Flight" },
          { value: "other", label: "Other" },
        ]}
      />
      <TextInput
        label="Origin"
        value={originName}
        onChange={(v) => set("originName", v)}
        placeholder="Central Station"
        maxLength={200}
      />
      <TextInput
        label="Destination"
        value={destinationName}
        onChange={(v) => set("destinationName", v)}
        placeholder="Airport"
        maxLength={200}
      />
      <TextInput
        label="Departure"
        value={departureDateTime}
        onChange={(v) => set("departureDateTime", v)}
        placeholder=""
        type="datetime-local"
      />
    </>
  )
}

function BusinessIdFields({ store }: { store: CardDesignStoreApi }) {
  const idLabel = useStore(store, (s) => s.programConfig.idLabel)
  const validDuration = useStore(store, (s) => s.programConfig.validDuration)
  const customDurationDays = useStore(store, (s) => s.programConfig.customDurationDays)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>Business ID</SectionHeader>
      <TextInput
        label="ID label"
        value={idLabel}
        onChange={(v) => set("idLabel", v)}
        placeholder="Employee ID"
        maxLength={100}
      />
      <SelectInput
        label="Valid duration"
        value={validDuration}
        onChange={(v) => set("validDuration", v)}
        options={[
          { value: "monthly", label: "Monthly" },
          { value: "yearly", label: "Yearly" },
          { value: "lifetime", label: "Lifetime" },
          { value: "custom", label: "Custom" },
        ]}
      />
      {validDuration === "custom" && (
        <NumberInput
          label="Custom duration"
          value={customDurationDays}
          onChange={(v) => set("customDurationDays", Math.max(1, v))}
          min={1}
          suffix="days"
        />
      )}
    </>
  )
}

// ─── Schedule Fields ─────────────────────────────────────────

function ScheduleFields({ store }: { store: CardDesignStoreApi }) {
  const startsAt = useStore(store, (s) => s.programConfig.startsAt)
  const endsAt = useStore(store, (s) => s.programConfig.endsAt)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>Schedule</SectionHeader>
      <TextInput
        label="Start date"
        value={startsAt}
        onChange={(v) => set("startsAt", v)}
        placeholder=""
        type="date"
      />
      <TextInput
        label="End date"
        value={endsAt}
        onChange={(v) => set("endsAt", v)}
        placeholder=""
        type="date"
      />
      {!endsAt && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: -4 }}>
          No end date — program runs indefinitely.
        </div>
      )}
    </>
  )
}

// ─── Main Panel ──────────────────────────────────────────────

type Props = {
  store: CardDesignStoreApi
  passType: string
}

export function ProgramPanel({ store, passType }: Props) {
  const name = useStore(store, (s) => s.programConfig.name)
  const terms = useStore(store, (s) => s.programConfig.terms)
  const set = store.getState().setConfigField

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>
        Configure your program. Changes are saved together with the card design.
      </div>

      <SectionHeader>General</SectionHeader>
      <TextInput
        label="Program name"
        value={name}
        onChange={(v) => set("name", v)}
        placeholder="My Loyalty Program"
        maxLength={200}
      />

      {passType === "STAMP_CARD" && <StampCardFields store={store} />}
      {passType === "COUPON" && <CouponFields store={store} />}
      {passType === "MEMBERSHIP" && <MembershipFields store={store} />}
      {passType === "POINTS" && <PointsFields store={store} />}
      {passType === "PREPAID" && <PrepaidFields store={store} />}
      {passType === "GIFT_CARD" && <GiftCardFields store={store} />}
      {passType === "TICKET" && <TicketFields store={store} />}
      {passType === "ACCESS" && <AccessFields store={store} />}
      {passType === "TRANSIT" && <TransitFields store={store} />}
      {passType === "BUSINESS_ID" && <BusinessIdFields store={store} />}

      <ScheduleFields store={store} />

      <SectionHeader>Terms & Conditions</SectionHeader>
      <TextArea
        label="Terms"
        value={terms}
        onChange={(v) => set("terms", v)}
        placeholder="Optional terms and conditions..."
        rows={3}
        maxLength={5000}
      />

    </div>
  )
}
