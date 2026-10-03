import { formatDateTime, formatDelta, formatQty, MOVEMENT_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

export type MovementItem = {
  id: number;
  type: string;
  quantity_delta: number;
  quantity_after: number;
  note: string | null;
  created_at: string;
  location?: { name: string } | null;
  product?: { name: string } | null;
};

/** Compact ledger list used on product pages, dashboards, and Stock History. */
export function MovementList({ items, showLocation = false }: { items: MovementItem[]; showLocation?: boolean }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No stock movements yet.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((m) => (
        <li key={m.id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {m.product ? m.product.name : (MOVEMENT_LABELS[m.type] ?? m.type)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {m.product ? `${MOVEMENT_LABELS[m.type] ?? m.type} · ` : ""}
              {showLocation && m.location ? `${m.location.name} · ` : ""}
              {formatDateTime(m.created_at)}
              {m.note ? ` · ${m.note}` : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                "text-sm font-bold tabular-nums",
                m.quantity_delta > 0 ? "text-mint-foreground" : "text-danger-foreground",
              )}
            >
              {formatDelta(m.quantity_delta)}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">= {formatQty(m.quantity_after)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
