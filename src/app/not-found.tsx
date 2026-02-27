import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="text-6xl font-bold text-muted-foreground/30">404</div>
        <h1 className="text-xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
