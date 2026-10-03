import { StatusChip } from "@/components/shared/status-chip";
import { formatQty } from "@/lib/format";
import type { DispatchDetail } from "./queries";

/** Read-only lines of a sent dispatch with the store's receipt and any discrepancy outcome. */
export function DispatchLines({ dispatch }: { dispatch: DispatchDetail }) {
  const received = dispatch.status !== "DRAFT" && dispatch.status !== "DISPATCHED";
  const total = dispatch.dispatch_lines.reduce((s, l) => s + l.quantity_sent, 0);
  return (
    <div className="rounded-xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {dispatch.dispatch_lines.map((l) => {
          const issue = l.quantity_missing + l.quantity_damaged > 0;
          return (
            <li key={l.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-semibold">{l.product?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {l.product?.sku} · {l.product?.barcode}
                </p>
                {issue && (
                  <p className="mt-1 text-sm text-peach-foreground">
                    {l.quantity_missing > 0 && `${formatQty(l.quantity_missing)} missing`}
                    {l.quantity_missing > 0 && l.quantity_damaged > 0 && " · "}
                    {l.quantity_damaged > 0 && `${formatQty(l.quantity_damaged)} damaged`}
                    {l.issue_note && ` — “${l.issue_note}”`}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 text-sm">
                <span className="tabular-nums">
                  Sent <strong>{formatQty(l.quantity_sent)}</strong>
                </span>
                {received && (
                  <span className="tabular-nums">
                    Received <strong>{formatQty(l.quantity_received)}</strong>
                  </span>
                )}
                {issue &&
                  (l.resolution ? (
                    <StatusChip tone="mint">{l.resolution === "WRITE_OFF" ? "Written off" : "Returned to stock"}</StatusChip>
                  ) : (
                    <StatusChip tone="peach">Open issue</StatusChip>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border px-4 py-3 text-right text-sm font-bold">Total sent {formatQty(total)} pieces</p>
    </div>
  );
}
