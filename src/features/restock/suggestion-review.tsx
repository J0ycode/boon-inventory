"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Forward, SkipForward, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StickyActionBar } from "@/components/shared/page-header";
import { QtyStepper } from "@/components/shared/qty-stepper";
import { StatusChip } from "@/components/shared/status-chip";
import { useTenantHref } from "@/components/shell/tenant-context";
import { useIdempotencyKey } from "@/lib/idempotency";
import { formatQty } from "@/lib/format";
import { deleteRequest, forwardSuggestions, reviewLine } from "./actions";

type Line = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  suggested: number | null;
  reorderLevel: number;
  status: "PENDING" | "APPROVED" | "SKIPPED";
};

/** Staff go through each suggested line — Approve (with an optional edited quantity) or Skip — then forward. */
export function SuggestionReview({ requestId, lines }: { requestId: string; lines: Line[] }) {
  const router = useRouter();
  const href = useTenantHref();
  const [key] = useIdempotencyKey();
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(lines.map((l) => [l.id, l.quantity])));

  const act = (line: Line, action: "APPROVE" | "SKIP") =>
    startTransition(async () => {
      const result = await reviewLine(line.id, action, action === "APPROVE" ? qty[line.id] : undefined);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });

  const open = lines.filter((l) => l.status === "PENDING").length;
  const approved = lines.filter((l) => l.status === "APPROVED");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" role="status">
        {open > 0 ? `${open} of ${lines.length} lines still need a decision.` : "Every line is reviewed. Forward when ready."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || open === 0}
          onClick={() =>
            startTransition(async () => {
              for (const l of lines.filter((x) => x.status === "PENDING")) {
                const r = await reviewLine(l.id, "APPROVE", qty[l.id]);
                if (!r.ok) {
                  toast.error(r.error);
                  break;
                }
              }
              router.refresh();
            })
          }
        >
          <Check aria-hidden /> Approve all remaining
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {lines.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-semibold">{l.name}</p>
              <p className="text-xs text-muted-foreground">
                {l.sku} · reorder at {formatQty(l.reorderLevel)}
                {l.suggested !== null && ` · suggested ${formatQty(l.suggested)}`}
              </p>
            </div>
            {l.status === "PENDING" ? (
              <>
                <QtyStepper
                  value={qty[l.id]!}
                  min={1}
                  onChange={(v) => setQty((q) => ({ ...q, [l.id]: v }))}
                  label={`Quantity of ${l.name}`}
                  disabled={pending}
                />
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" disabled={pending} onClick={() => act(l, "SKIP")}>
                    <SkipForward aria-hidden /> Skip
                  </Button>
                  <Button type="button" disabled={pending} onClick={() => act(l, "APPROVE")}>
                    <Check aria-hidden /> Approve
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <span className="font-bold tabular-nums">{l.status === "APPROVED" ? formatQty(l.quantity) : "—"}</span>
                <StatusChip status={l.status} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <StickyActionBar>
        <ConfirmDialog
          destructive
          title="Discard these suggestions?"
          description="Nothing is sent. Low-stock items will be suggested again next time."
          confirmLabel="Discard"
          onConfirm={async () => {
            const r = await deleteRequest(requestId);
            if (!r.ok) {
              toast.error(r.error);
              return false;
            }
            router.push(href("/store/requests"));
          }}
          trigger={
            <Button type="button" variant="ghost">
              <Trash2 aria-hidden /> Discard
            </Button>
          }
        />
        <ConfirmDialog
          title={`Forward ${approved.length} lines to the Store Room?`}
          description={`${formatQty(approved.reduce((s, l) => s + l.quantity, 0))} pieces. Skipped lines are not sent.`}
          confirmLabel="Forward"
          onConfirm={async () => {
            const r = await forwardSuggestions(requestId, key);
            if (!r.ok) {
              toast.error(r.error);
              return false;
            }
            toast.success("Forwarded to the Store Room");
            router.push(href("/store/requests"));
          }}
          trigger={
            <Button type="button" disabled={open > 0 || approved.length === 0}>
              <Forward aria-hidden /> Forward to Store Room
            </Button>
          }
        />
      </StickyActionBar>
    </div>
  );
}
