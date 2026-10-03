import { cn } from "@/lib/utils";

export type ChipTone = "neutral" | "mint" | "blue" | "peach" | "lavender" | "danger";

const TONES: Record<ChipTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  mint: "bg-mint text-mint-foreground",
  blue: "bg-blue text-blue-foreground",
  peach: "bg-peach text-peach-foreground",
  lavender: "bg-lavender text-lavender-foreground",
  danger: "bg-danger text-danger-foreground",
};

/**
 * One chip vocabulary for every status in the app, so the same state always looks the same.
 * Text carries the meaning; colour only reinforces it.
 */
export const STATUS_TONES: Record<string, ChipTone> = {
  // dispatches
  DRAFT: "neutral",
  DISPATCHED: "blue",
  RECEIVED: "mint",
  RECEIVED_WITH_ISSUES: "peach",
  RESOLVED: "mint",
  // restock requests
  WAITING_STAFF_APPROVAL: "lavender",
  SENT: "blue",
  APPROVED: "mint",
  REJECTED: "danger",
  // approvals / lines
  PENDING: "lavender",
  SKIPPED: "neutral",
  // stock
  LOW: "peach",
  OUT: "danger",
  IN_STOCK: "mint",
  // purchase bills
  PAID: "mint",
  UNPAID: "blue",
  DUE_SOON: "peach",
  OVERDUE: "danger",
};

const LABELS: Record<string, string> = {
  RECEIVED_WITH_ISSUES: "Received with issues",
  WAITING_STAFF_APPROVAL: "Waiting for staff approval",
  IN_STOCK: "In stock",
  OUT: "Out of stock",
  LOW: "Low stock",
};

export function statusLabel(status: string): string {
  return LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " ");
}

export function StatusChip({
  status,
  tone,
  children,
  className,
}: {
  status?: string;
  tone?: ChipTone;
  children?: React.ReactNode;
  className?: string;
}) {
  const resolved = tone ?? (status ? STATUS_TONES[status] : undefined) ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold whitespace-nowrap",
        TONES[resolved],
        className,
      )}
    >
      {children ?? (status ? statusLabel(status) : null)}
    </span>
  );
}
