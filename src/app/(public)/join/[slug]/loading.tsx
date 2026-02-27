export default function JoinLoading() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-8 animate-pulse">
        {/* Logo placeholder */}
        <div className="flex flex-col items-center space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-muted" />
          <div className="space-y-2 text-center">
            <div className="h-7 w-48 bg-muted rounded-md mx-auto" />
            <div className="h-5 w-56 bg-muted rounded-md mx-auto" />
          </div>
          <div className="h-9 w-72 bg-muted rounded-full mx-auto" />
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-10 w-full bg-muted rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-10 w-full bg-muted rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-10 w-full bg-muted rounded-lg" />
          </div>
          <div className="h-12 w-full bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  )
}
