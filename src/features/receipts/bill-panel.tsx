"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, LoaderCircle, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form-fields";
import { StatusChip } from "@/components/shared/status-chip";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { setReceiptBill, setReceiptPayment } from "./actions";
import { PaymentFields, uploadBill, type PaymentValue } from "./bill-fields";
import { BILL_MIME_TYPES, BILL_STATE_LABELS, billFileError, billState, type PaymentStatus } from "./schemas";

export type BillInfo = {
  id: string;
  tenantId: string;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  amount: number | null;
  billUrl: string | null;
  hasBill: boolean;
};

/** Payment status, deadline, amount and the attached bill file for one receipt. */
export function BillPanel({ bill }: { bill: BillInfo }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const state = billState(bill.status, bill.dueDate);
  const refresh = () => startTransition(() => router.refresh());

  const markPaid = async () => {
    const r = await setReceiptPayment({
      receiptId: bill.id,
      paymentStatus: "PAID",
      billAmount: bill.amount ?? undefined,
    });
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success("Bill marked as paid");
    refresh();
    return true;
  };

  const onFile = async (file: File) => {
    const problem = billFileError(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading(true);
    try {
      const path = await uploadBill(bill.tenantId, bill.id, file);
      const r = await setReceiptBill(bill.id, path);
      if (!r.ok) throw new Error(r.error);
      toast.success(bill.hasBill ? "Bill file replaced" : "Bill file attached");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The bill file could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async () => {
    const r = await setReceiptBill(bill.id, null);
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success("Bill file removed");
    refresh();
    return true;
  };

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Payment</CardTitle>
        <StatusChip status={state}>{BILL_STATE_LABELS[state]}</StatusChip>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Bill amount</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(bill.amount)}</dd>
          </div>
          {bill.status === "UNPAID" ? (
            <div>
              <dt className="text-muted-foreground">Payment deadline</dt>
              <dd className={state === "OVERDUE" ? "font-semibold text-destructive" : "font-semibold"}>
                {formatDate(bill.dueDate)}
              </dd>
            </div>
          ) : (
            <div>
              <dt className="text-muted-foreground">Paid on</dt>
              <dd className="font-semibold">{formatDateTime(bill.paidAt)}</dd>
            </div>
          )}
          <div className="min-w-0">
            <dt className="text-muted-foreground">Bill copy</dt>
            <dd className="font-semibold">
              {bill.billUrl ? (
                <a
                  href={bill.billUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  View bill <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : (
                <span className="text-muted-foreground">Not attached</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          {bill.status === "UNPAID" && (
            <ConfirmDialog
              title="Mark this bill as paid?"
              description="Use this once the supplier has been paid. You can change it back later if needed."
              confirmLabel="Mark as paid"
              onConfirm={markPaid}
              trigger={<Button type="button">Mark as paid</Button>}
            />
          )}
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            <Pencil aria-hidden /> Edit payment
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={BILL_MIME_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onFile(f);
            }}
          />
          <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? <LoaderCircle className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
            {bill.hasBill ? "Replace bill file" : "Upload bill file"}
          </Button>
          {bill.hasBill && (
            <ConfirmDialog
              title="Remove the bill file?"
              description="The uploaded copy is deleted. The receipt and its stock are not affected."
              confirmLabel="Remove file"
              destructive
              onConfirm={removeFile}
              trigger={
                <Button type="button" variant="ghost">
                  <Trash2 aria-hidden /> Remove file
                </Button>
              }
            />
          )}
        </div>
      </CardContent>
      {editing && <EditPaymentDialog bill={bill} onClose={() => setEditing(false)} onSaved={refresh} />}
    </Card>
  );
}

function EditPaymentDialog({ bill, onClose, onSaved }: { bill: BillInfo; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState<PaymentValue>({
    status: bill.status as PaymentStatus,
    dueDate: bill.dueDate ?? "",
    amount: bill.amount === null ? "" : String(bill.amount),
  });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const save = async () => {
    setTouched(true);
    if (value.status === "UNPAID" && !value.dueDate) return;
    setSaving(true);
    const r = await setReceiptPayment({
      receiptId: bill.id,
      paymentStatus: value.status,
      dueDate: value.status === "UNPAID" ? value.dueDate : undefined,
      billAmount: value.amount === "" ? undefined : Number(value.amount),
    });
    setSaving(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast.success("Payment details saved");
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit payment</DialogTitle>
          <DialogDescription>Change whether this bill is paid, its deadline or its amount.</DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <PaymentFields value={value} onChange={setValue} idPrefix="edit-payment" showErrors={touched} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving && <LoaderCircle className="animate-spin" aria-hidden />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
