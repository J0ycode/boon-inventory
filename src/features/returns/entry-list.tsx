"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusChip } from "@/components/shared/status-chip";
import { formatDateTime, formatQty } from "@/lib/format";
import { decideEntry } from "./actions";

export type EntryRow = {
  id: string;
  number: string;
  type: "RETURN_TO_STOREROOM" | "DAMAGE" | "SUPPLIER_RETURN";
  quantity: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
  decision_note: string | null;
  product: { name: string; sku: string } | null;
  location: { name: string } | null;
  creator: { full_name: string } | null;
};

const TYPE_LABEL = { RETURN_TO_STOREROOM: "Return to Store Room", DAMAGE: "Damaged", SUPPLIER_RETURN: "Return to supplier" };

export function EntryList({ items, canDecide, showLocation }: { items: EntryRow[]; canDecide: boolean; showLocation: boolean }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Nothing here.</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {items.map((e) => (
        <li key={e.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold">{e.product?.name}</p>
              <p className="text-sm text-muted-foreground">
                {e.number} · {TYPE_LABEL[e.type]}
                {showLocation && e.location ? ` · ${e.location.name}` : ""} · {formatDateTime(e.created_at)}
                {e.creator ? ` · ${e.creator.full_name}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-lg font-extrabold tabular-nums">{formatQty(e.quantity)}</span>
              <StatusChip status={e.status} />
            </div>
          </div>
          <p className="text-sm">“{e.reason}”</p>
          {e.decision_note && <p className="text-sm text-muted-foreground">Store Room: {e.decision_note}</p>}
          {canDecide && e.status === "PENDING" && <Decide entry={e} />}
        </li>
      ))}
    </ul>
  );
}

function Decide({ entry }: { entry: EntryRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const r = await decideEntry(entry.id, approve, note, crypto.randomUUID());
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success(approve ? `${entry.number} approved` : `${entry.number} rejected`);
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <X aria-hidden /> Reject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {entry.number}?</DialogTitle>
            <DialogDescription>The store will see your reason. Stock is not changed.</DialogDescription>
          </DialogHeader>
          <Label htmlFor={`reject-${entry.id}`}>Reason</Label>
          <Textarea id={`reject-${entry.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          <DialogFooter>
            <Button variant="destructive" disabled={busy || !note.trim()} onClick={() => decide(false)}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        title={`Approve ${entry.number}?`}
        description={
          entry.type === "RETURN_TO_STOREROOM"
            ? `${formatQty(entry.quantity)} pieces move from ${entry.location?.name} to the Store Room.`
            : `${formatQty(entry.quantity)} pieces are written off at ${entry.location?.name}.`
        }
        confirmLabel="Approve"
        onConfirm={() => decide(true)}
        trigger={
          <Button>
            <Check aria-hidden /> Approve
          </Button>
        }
      />
    </div>
  );
}
