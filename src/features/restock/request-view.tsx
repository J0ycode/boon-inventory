import { StatusChip } from "@/components/shared/status-chip";
import { formatQty } from "@/lib/format";
import type { RequestDetail } from "./queries";

/** Read-only request lines. Skipped suggestion lines are shown struck through. */
export function RequestLines({ request }: { request: RequestDetail }) {
  const counted = request.restock_request_lines.filter((l) => l.line_status !== "SKIPPED");
  return (
    <div className="rounded-xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {request.restock_request_lines.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className={l.line_status === "SKIPPED" ? "min-w-0 text-muted-foreground line-through" : "min-w-0"}>
              <span className="block font-semibold">{l.product?.name}</span>
              <span className="block text-xs text-muted-foreground">{l.product?.sku}</span>
            </span>
            {l.line_status === "SKIPPED" ? (
              <StatusChip status="SKIPPED" />
            ) : (
              <span className="font-bold tabular-nums">{formatQty(l.quantity)}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-4 py-3 text-right text-sm font-bold">
        {formatQty(counted.reduce((s, l) => s + l.quantity, 0))} pieces in {counted.length} products
      </p>
    </div>
  );
}
