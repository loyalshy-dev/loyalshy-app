export default function QrCodeLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-32 bg-muted animate-pulse rounded-md" />
        <div className="h-5 w-80 bg-muted animate-pulse rounded-md mt-1" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-8 animate-pulse">
          <div className="w-64 h-64 bg-muted rounded-lg mx-auto" />
        </div>
        <div className="space-y-4 animate-pulse">
          <div className="h-20 bg-muted rounded-lg" />
          <div className="h-20 bg-muted rounded-lg" />
          <div className="h-20 bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  )
}
