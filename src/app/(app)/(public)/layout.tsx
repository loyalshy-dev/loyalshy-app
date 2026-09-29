export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div data-brand="loyalshy" className="min-h-svh bg-background text-foreground">
      {children}
    </div>
  )
}
