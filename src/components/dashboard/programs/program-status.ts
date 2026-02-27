// Shared status badge configuration for DRAFT/ACTIVE/ARCHIVED program statuses

export const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-success/10 text-success border-success/20",
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-warning/10 text-warning border-warning/20",
  },
}
