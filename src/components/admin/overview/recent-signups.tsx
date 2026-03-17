import { formatDistanceToNow } from "date-fns"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

type RecentSignupsProps = {
  users: { id: string; name: string; email: string; createdAt: Date }[]
}

export function RecentSignups({ users }: RecentSignupsProps) {
  if (users.length === 0) {
    return (
      <Card className="p-5 space-y-4">
        <h3 className="text-[13px] font-medium text-muted-foreground">
          Recent Signups
        </h3>
        <p className="text-sm text-muted-foreground">No users yet.</p>
      </Card>
    )
  }

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-[13px] font-medium text-muted-foreground">
        Recent Signups
      </h3>
      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="flex items-center gap-3">
            <Avatar className="size-7">
              <AvatarFallback className="text-[10px] font-medium">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium truncate">{user.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
