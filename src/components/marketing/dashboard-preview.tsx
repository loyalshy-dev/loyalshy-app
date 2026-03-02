/**
 * DashboardPreview — A CSS-only mockup of the Loyalshy dashboard
 * shown below the hero to give prospects a preview of the product.
 *
 * Server Component — no client-side interactivity required.
 */

export function DashboardPreview() {
  return (
    <section className="relative pb-12 sm:pb-20 -mt-4">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        {/* Browser chrome frame */}
        <div className="relative rounded-xl border border-border bg-card shadow-[0_8px_40px_oklch(0_0_0/0.08),0_0_0_1px_oklch(0_0_0/0.04)] overflow-hidden">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="rounded-md bg-background border border-border px-10 py-1 text-[11px] text-muted-foreground">
                app.loyalshy.com/dashboard
              </div>
            </div>
            <div className="w-[52px]" />
          </div>

          {/* Dashboard content mockup */}
          <div className="flex min-h-[280px] sm:min-h-[340px]">
            {/* Sidebar mockup */}
            <div
              className="hidden sm:flex w-[180px] shrink-0 flex-col gap-1 p-3 border-r"
              style={{
                background: "oklch(0.16 0.005 285)",
                borderColor: "oklch(0.25 0.008 285)",
              }}
            >
              {/* Logo */}
              <div className="flex items-center gap-1.5 px-2 py-2 mb-2">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ background: "oklch(0.55 0.2 265)" }}
                />
                <span className="text-[12px] font-bold" style={{ color: "oklch(0.97 0 0)" }}>
                  Loyalshy
                </span>
              </div>
              {/* Nav items */}
              {["Overview", "Customers", "Programs"].map((item, i) => (
                <div
                  key={item}
                  className="rounded-md px-2.5 py-1.5 text-[11px] font-medium"
                  style={{
                    background: i === 0 ? "oklch(0.22 0.008 285)" : "transparent",
                    color: i === 0 ? "oklch(0.97 0 0)" : "oklch(0.55 0.01 285)",
                  }}
                >
                  {item}
                </div>
              ))}
              <div className="mt-auto">
                <div
                  className="rounded-md px-2.5 py-1.5 text-[11px] font-medium"
                  style={{ color: "oklch(0.55 0.01 285)" }}
                >
                  Settings
                </div>
              </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 p-4 sm:p-5 bg-background">
              {/* Header */}
              <div className="mb-4 sm:mb-5">
                <div className="text-[13px] sm:text-[14px] font-semibold text-foreground">
                  Overview
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Welcome back, Maria
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-4 sm:mb-5">
                {[
                  { label: "Total Customers", value: "284", change: "+12%" },
                  { label: "Visits This Week", value: "147", change: "+8%" },
                  { label: "Active Programs", value: "2", change: "" },
                  { label: "Rewards Earned", value: "38", change: "+23%" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="text-[10px] text-muted-foreground mb-1">
                      {stat.label}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[16px] sm:text-[18px] font-bold tabular-nums text-foreground">
                        {stat.value}
                      </span>
                      {stat.change && (
                        <span className="text-[10px] font-medium text-success">
                          {stat.change}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart placeholder */}
              <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
                <div className="text-[11px] font-medium text-foreground mb-3">
                  Visits This Month
                </div>
                {/* Simple bar chart mockup */}
                <div className="flex items-end gap-1.5 h-16 sm:h-20">
                  {[40, 65, 50, 80, 70, 90, 55, 75, 85, 60, 95, 72].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm min-w-0"
                      style={{
                        height: `${h}%`,
                        background:
                          i === 10
                            ? "oklch(0.55 0.2 265)"
                            : "oklch(0.55 0.2 265 / 0.2)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fade out at bottom */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 sm:h-24"
          style={{
            background: "linear-gradient(to top, var(--background), transparent)",
          }}
        />
      </div>
    </section>
  )
}
