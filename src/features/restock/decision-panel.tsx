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
import { FormError } from "@/components/shared/form-fields";
import { StickyActionBar } from "@/components/shared/page-header";
import { useTenantHref } from "@/components/shell/tenant-context";
import { useIdempotencyKey } from "@/lib/idempotency";
import { decideRequest } from "./actions";

/** Store Room decision: approve → opens the pre-filled draft dispatch; reject → requires a reason for the store. */
export function DecisionPanel({ requestId, storeName }: { requestId: string; storeName: string }) {
  const router = useRouter();
  const href = useTenantHref();
  const [key] = useIdempotencyKey();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  return (
    <StickyActionBar>
      <Dialog open={rejectOpen} onOpenChange={(o) => !busy && setRejectOpen(o)}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            <X aria-hidden /> Reject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this request?</DialogTitle>
            <DialogDescription>{storeName} will see your reason.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !reason.trim()}
              onClick={async () => {
                setBusy(true);
                const r = await decideRequest(requestId, false, reason, key);
                setBusy(false);
                if (!r.ok) return setError(r.error);
                toast.success("Request rejected");
                setRejectOpen(false);
                router.push(href("/storeroom/requests"));
              }}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        title="Approve and prepare a dispatch?"
        description="A draft dispatch is created with these lines. You can adjust quantities before sending."
        confirmLabel="Approve"
        onConfirm={async () => {
          const r = await decideRequest(requestId, true, "", key);
          if (!r.ok) {
            toast.error(r.error);
            return false;
          }
          toast.success("Approved. Review the dispatch and press Send.");
          router.push(href(`/storeroom/dispatch/${r.data.dispatchId}`));
        }}
        trigger={
          <Button type="button">
            <Check aria-hidden /> Approve & prepare dispatch
          </Button>
        }
      />
    </StickyActionBar>
  );
}
