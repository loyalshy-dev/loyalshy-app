import { redirect } from "next/navigation"

// Moved under Automations (2026-10-02); kept so old links and bookmarks work.
export default function ReviewsRedirect() {
  redirect("/dashboard/automations/reviews")
}
