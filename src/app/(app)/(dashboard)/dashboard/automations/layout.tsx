import { AutomationsHeader } from "@/components/dashboard/automations/automations-header"

// Automations: Google review prompts + win-back. Each tab page does its own
// DAL auth (owner + admin); the layout is static chrome only.
export default function AutomationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <AutomationsHeader />
      {children}
    </div>
  )
}
