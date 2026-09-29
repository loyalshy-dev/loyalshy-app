export default function FunnelLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-80 rounded bg-muted/50 animate-pulse" />
        </div>
        <div className="h-9 w-56 rounded-full bg-muted/50 animate-pulse" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 rounded bg-muted animate-pulse" />
              <div className="h-7 w-20 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/40 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
