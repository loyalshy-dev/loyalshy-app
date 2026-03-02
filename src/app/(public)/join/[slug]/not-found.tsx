import Link from "next/link"

export default function JoinNotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="text-6xl font-bold text-muted-foreground/30">404</div>
        <h1 className="text-xl font-semibold tracking-tight">
          Restaurant not found
        </h1>
        <p className="text-sm text-muted-foreground">
          This loyalty program link doesn't exist or may have been removed.
          Check with the restaurant for the correct QR code.
        </p>
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          Go to Loyalshy
        </Link>
      </div>
    </div>
  )
}
