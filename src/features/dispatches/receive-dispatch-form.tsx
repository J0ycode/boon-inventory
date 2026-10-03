"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form-fields";
import { StickyActionBar } from "@/components/shared/page-header";
import { QtyStepper } from "@/components/shared/qty-stepper";
import { useTenantHref } from "@/components/shell/tenant-context";
import { useIdempotencyKey } from "@/lib/idempotency";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { receiveDispatch } from "./actions";

type Line = { id: string; name: string; sku: string; sent: number };
type Entry = { received: number; missing: number; damaged: number; note: string; flagged: boolean };

/**
 * Store staff confirm what arrived. Each line defaults to "all received"; "Report a problem" reveals missing and
 * damaged steppers plus a required note. Received is recalculated so the three always add up to what was sent.
 */
export function ReceiveDispatchForm({ dispatchId, lines }: { dispatchId: string; lines: Line[] }) {
  const router = useRouter();
  const href = useTenantHref();
  const [key] = useIdempotencyKey();
  const [error, setError] = useState<string>();
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, { received: l.sent, missing: 0, damaged: 0, note: "", flagged: false }])),
  );

  const set = (line: Line, patch: Partial<Entry>) =>
    setEntries((all) => {
      const next = { ...all[line.id]!, ...patch };
      next.missing = Math.min(next.missing, line.sent);
      next.damaged = Math.min(next.damaged, line.sent - next.missing);
      next.received = line.sent - next.missing - next.damaged;
      return { ...all, [line.id]: next };
    });

  const issues = lines.filter((l) => entries[l.id]!.missing + entries[l.id]!.damaged > 0);
  const missingNotes = issues.filter((l) => !entries[l.id]!.note.trim());
  const totalReceived = lines.reduce((s, l) => s + entries[l.id]!.received, 0);

  return (
    <div className="flex flex-col gap-4">
      <FormError message={error} />
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {lines.map((l) => {
          const e = entries[l.id]!;
          const hasIssue = e.missing + e.damaged > 0;
          return (
            <li key={l.id} className="flex flex-col gap-3 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.sku} · sent {formatQty(l.sent)}
                  </p>
                </div>
                <p className={cn("text-sm tabular-nums", hasIssue && "font-bold text-peach-foreground")}>
                  Received {formatQty(e.received)} of {formatQty(l.sent)}
                </p>
              </div>
              {e.flagged ? (
                <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr] sm:items-end">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-muted-foreground">Missing</span>
                    <QtyStepper value={e.missing} max={l.sent} onChange={(missing) => set(l, { missing })} label={`Missing pieces of ${l.name}`} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-muted-foreground">Damaged</span>
                    <QtyStepper
                      value={e.damaged}
                      max={l.sent - e.missing}
                      onChange={(damaged) => set(l, { damaged })}
                      label={`Damaged pieces of ${l.name}`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`note-${l.id}`} className="text-xs text-muted-foreground">
                      What happened? {hasIssue && <span className="text-danger-foreground">(required)</span>}
                    </Label>
                    <Input
                      id={`note-${l.id}`}
                      value={e.note}
                      onChange={(ev) => set(l, { note: ev.target.value })}
                      maxLength={500}
                      aria-invalid={(hasIssue && !e.note.trim()) || undefined}
                      autoComplete="off"
                    />
                  </div>
                </div>
              ) : (
                <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => set(l, { flagged: true })}>
                  Report missing or damaged
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <StickyActionBar>
        <ConfirmDialog
          title={issues.length ? "Confirm delivery with issues?" : "Confirm delivery?"}
          description={
            issues.length
              ? `${formatQty(totalReceived)} pieces will be added to your stock. ${issues.length} line(s) will be reported to the Store Room.`
              : `${formatQty(totalReceived)} pieces will be added to your stock.`
          }
          confirmLabel="Confirm"
          onConfirm={async () => {
            setError(undefined);
            const result = await receiveDispatch(
              dispatchId,
              lines.map((l) => {
                const e = entries[l.id]!;
                return { line_id: l.id, received: e.received, missing: e.missing, damaged: e.damaged, note: e.note };
              }),
              key,
            );
            if (!result.ok) {
              setError(result.error);
              return false;
            }
            toast.success(issues.length ? "Delivery confirmed. Issues sent to the Store Room." : "Delivery confirmed");
            router.push(href("/store/incoming"));
            router.refresh();
          }}
          trigger={
            <Button type="button" disabled={missingNotes.length > 0}>
              {missingNotes.length > 0 ? "Add a note for each problem" : `Confirm ${formatQty(totalReceived)} received`}
            </Button>
          }
        />
      </StickyActionBar>
    </div>
  );
}
