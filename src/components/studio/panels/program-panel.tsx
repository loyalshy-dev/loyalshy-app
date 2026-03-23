"use client"

import { useStore } from "zustand"
import { useTranslations } from "next-intl"
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
  const t = useTranslations("dashboard.programEditor")
  const stampsRequired = useStore(store, (s) => s.programConfig.stampsRequired)
  const rewardExpiryDays = useStore(store, (s) => s.programConfig.rewardExpiryDays)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>{t("stampConfiguration")}</SectionHeader>
      <NumberInput
        label={t("visitsRequired")}
        value={stampsRequired}
        onChange={(v) => set("stampsRequired", Math.max(3, Math.min(10, v)))}
        min={3}
        max={10}
        suffix={t("stampsSuffix")}
      />
      <NumberInput
        label={t("rewardExpiry")}
        value={rewardExpiryDays}
        onChange={(v) => set("rewardExpiryDays", Math.max(0, v))}
        min={0}
        suffix={t("rewardExpirySuffix")}
      />
    </>
  )
}

function CouponFields({ store }: { store: CardDesignStoreApi }) {
  const t = useTranslations("dashboard.programEditor")
  const discountType = useStore(store, (s) => s.programConfig.discountType)
  const discountValue = useStore(store, (s) => s.programConfig.discountValue)
  const couponCode = useStore(store, (s) => s.programConfig.couponCode)
  const couponDescription = useStore(store, (s) => s.programConfig.couponDescription)
  const validUntil = useStore(store, (s) => s.programConfig.validUntil)
  const redemptionLimit = useStore(store, (s) => s.programConfig.redemptionLimit)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>{t("couponConfiguration")}</SectionHeader>
      <SelectInput
        label={t("discountType")}
        value={discountType}
        onChange={(v) => set("discountType", v)}
        options={[
          { value: "percentage", label: t("discountTypePercentage") },
          { value: "fixed", label: t("discountTypeFixed") },
          { value: "freebie", label: t("discountTypeFreebie") },
        ]}
      />
      {(discountType === "percentage" || discountType === "fixed") && (
        <NumberInput
          label={discountType === "percentage" ? t("discountPercent") : t("discountAmount")}
          value={discountValue}
          onChange={(v) => set("discountValue", Math.max(0, v))}
          min={0}
          suffix={discountType === "percentage" ? "%" : ""}
        />
      )}
      <TextInput
        label={t("couponCode")}
        value={couponCode}
        onChange={(v) => set("couponCode", v)}
        placeholder={t("couponCodePlaceholder")}
        maxLength={50}
      />
      <TextInput
        label={t("couponDescription")}
        value={couponDescription}
        onChange={(v) => set("couponDescription", v)}
        placeholder={t("couponDescriptionPlaceholder")}
        maxLength={200}
      />
      <TextInput
        label={t("validUntil")}
        value={validUntil}
        onChange={(v) => set("validUntil", v)}
        placeholder=""
        type="date"
      />
      <SelectInput
        label={t("redemptionLimit")}
        value={redemptionLimit}
        onChange={(v) => set("redemptionLimit", v)}
        options={[
          { value: "single", label: t("redemptionSingle") },
          { value: "unlimited", label: t("redemptionUnlimited") },
        ]}
      />
    </>
  )
}

function MembershipFields({ store }: { store: CardDesignStoreApi }) {
  const t = useTranslations("dashboard.programEditor")
  const membershipTier = useStore(store, (s) => s.programConfig.membershipTier)
  const benefits = useStore(store, (s) => s.programConfig.benefits)
  const validDuration = useStore(store, (s) => s.programConfig.validDuration)
  const customDurationDays = useStore(store, (s) => s.programConfig.customDurationDays)
  const autoRenew = useStore(store, (s) => s.programConfig.autoRenew)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>{t("membershipConfiguration")}</SectionHeader>
      <TextInput
        label={t("membershipTier")}
        value={membershipTier}
        onChange={(v) => set("membershipTier", v)}
        placeholder={t("membershipTierPlaceholder")}
        maxLength={100}
      />
      <TextArea
        label={t("benefits")}
        value={benefits}
        onChange={(v) => set("benefits", v)}
        placeholder={t("benefitsPlaceholder")}
        rows={4}
        maxLength={1000}
      />
      <SelectInput
        label={t("duration")}
        value={validDuration}
        onChange={(v) => set("validDuration", v)}
        options={[
          { value: "monthly", label: t("durationMonthly") },
          { value: "yearly", label: t("durationYearly") },
          { value: "lifetime", label: t("durationLifetime") },
          { value: "custom", label: t("durationCustom") },
        ]}
      />
      {validDuration === "custom" && (
        <NumberInput
          label={t("customDuration")}
          value={customDurationDays}
          onChange={(v) => set("customDurationDays", Math.max(1, v))}
          min={1}
          suffix={t("daysSuffix")}
        />
      )}
      <ToggleInput
        label={t("autoRenew")}
        description={t("autoRenewDesc")}
        value={autoRenew}
        onChange={(v) => set("autoRenew", v)}
      />
    </>
  )
}

function PointsFields({ store }: { store: CardDesignStoreApi }) {
  const t = useTranslations("dashboard.programEditor")
  const pointsPerVisit = useStore(store, (s) => s.programConfig.pointsPerVisit)
  const pointsLabel = useStore(store, (s) => s.programConfig.pointsLabel)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>{t("pointsConfiguration")}</SectionHeader>
      <NumberInput
        label={t("pointsPerVisit")}
        value={pointsPerVisit}
        onChange={(v) => set("pointsPerVisit", Math.max(1, v))}
        min={1}
        suffix={pointsLabel || t("pointsLabelPlaceholder")}
      />
      <TextInput
        label={t("pointsLabel")}
        value={pointsLabel}
        onChange={(v) => set("pointsLabel", v)}
        placeholder={t("pointsLabelPlaceholder")}
        maxLength={20}
      />
    </>
  )
}

function GiftCardFields({ store }: { store: CardDesignStoreApi }) {
  const t = useTranslations("dashboard.programEditor")
  const currency = useStore(store, (s) => s.programConfig.currency)
  const initialBalanceCents = useStore(store, (s) => s.programConfig.initialBalanceCents)
  const partialRedemption = useStore(store, (s) => s.programConfig.partialRedemption)
  const expiryMonths = useStore(store, (s) => s.programConfig.expiryMonths)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>{t("giftCardConfiguration")}</SectionHeader>
      <TextInput
        label={t("currency")}
        value={currency}
        onChange={(v) => set("currency", v)}
        placeholder={t("currencyPlaceholder")}
        maxLength={5}
      />
      <NumberInput
        label={t("initialBalanceCents")}
        value={initialBalanceCents}
        onChange={(v) => set("initialBalanceCents", Math.max(0, v))}
        min={0}
      />
      <ToggleInput
        label={t("partialRedemption")}
        description={t("partialRedemptionDesc")}
        value={partialRedemption}
        onChange={(v) => set("partialRedemption", v)}
      />
      <NumberInput
        label={t("expiryMonths")}
        value={expiryMonths}
        onChange={(v) => set("expiryMonths", Math.max(0, v))}
        min={0}
      />
    </>
  )
}

function TicketFields({ store }: { store: CardDesignStoreApi }) {
  const t = useTranslations("dashboard.programEditor")
  const eventName = useStore(store, (s) => s.programConfig.eventName)
  const eventDate = useStore(store, (s) => s.programConfig.eventDate)
  const eventVenue = useStore(store, (s) => s.programConfig.eventVenue)
  const maxScans = useStore(store, (s) => s.programConfig.maxScans)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>{t("ticketConfiguration")}</SectionHeader>
      <TextInput
        label={t("eventName")}
        value={eventName}
        onChange={(v) => set("eventName", v)}
        placeholder={t("eventNamePlaceholder")}
        maxLength={200}
      />
      <TextInput
        label={t("eventDate")}
        value={eventDate}
        onChange={(v) => set("eventDate", v)}
        placeholder=""
        type="date"
      />
      <TextInput
        label={t("venue")}
        value={eventVenue}
        onChange={(v) => set("eventVenue", v)}
        placeholder={t("venuePlaceholder")}
        maxLength={200}
      />
      <NumberInput
        label={t("maxScans")}
        value={maxScans}
        onChange={(v) => set("maxScans", Math.max(1, v))}
        min={1}
      />
    </>
  )
}

// ─── Schedule Fields ─────────────────────────────────────────

function ScheduleFields({ store }: { store: CardDesignStoreApi }) {
  const t = useTranslations("dashboard.programEditor")
  const startsAt = useStore(store, (s) => s.programConfig.startsAt)
  const endsAt = useStore(store, (s) => s.programConfig.endsAt)
  const set = store.getState().setConfigField

  return (
    <>
      <SectionHeader>{t("scheduleSection")}</SectionHeader>
      <TextInput
        label={t("startDate")}
        value={startsAt}
        onChange={(v) => set("startsAt", v)}
        placeholder=""
        type="date"
      />
      <TextInput
        label={t("endDate")}
        value={endsAt}
        onChange={(v) => set("endsAt", v)}
        placeholder=""
        type="date"
      />
      {!endsAt && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: -4 }}>
          {t("noEndDate")}
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
  const t = useTranslations("dashboard.programEditor")
  const name = useStore(store, (s) => s.programConfig.name)
  const terms = useStore(store, (s) => s.programConfig.terms)
  const set = store.getState().setConfigField

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 12 }}>
        {t("programPanelDesc")}
      </div>

      <SectionHeader>{t("generalSection")}</SectionHeader>
      <TextInput
        label={t("programName")}
        value={name}
        onChange={(v) => set("name", v)}
        placeholder="My Loyalty Program"
        maxLength={200}
      />

      {passType === "STAMP_CARD" && <StampCardFields store={store} />}
      {passType === "COUPON" && <CouponFields store={store} />}
      {passType === "MEMBERSHIP" && <MembershipFields store={store} />}
      {passType === "POINTS" && <PointsFields store={store} />}
      {passType === "GIFT_CARD" && <GiftCardFields store={store} />}
      {passType === "TICKET" && <TicketFields store={store} />}

      <ScheduleFields store={store} />

      <SectionHeader>{t("termsSection")}</SectionHeader>
      <TextArea
        label={t("terms")}
        value={terms}
        onChange={(v) => set("terms", v)}
        placeholder={t("termsPlaceholder")}
        rows={3}
        maxLength={5000}
      />

    </div>
  )
}
